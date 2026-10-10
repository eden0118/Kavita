using System.Security.Cryptography;
using Mono.Cecil;
using Mono.Cecil.Cil;

if (args.Length != 2) throw new ArgumentException("Usage: Patch <original.dll> <patched.dll>");
const string expectedHash = "a0d472778f05060630cba0909087dc2d22b47f9a1543de2663cbc77cb171ae99";
if (!Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(args[0]))).Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Unsupported Kavita.Services.dll; only the pinned 0.9.1.4 build is supported.");

using var resolver = new DefaultAssemblyResolver();
resolver.AddSearchDirectory(Path.GetDirectoryName(Path.GetFullPath(args[0]))!);
using var assembly = AssemblyDefinition.ReadAssembly(args[0], new ReaderParameters { AssemblyResolver = resolver });
if (assembly.Name.Name != "Kavita.Services" || assembly.Name.HasPublicKey)
    throw new InvalidOperationException("Unexpected or signed assembly.");
var type = assembly.MainModule.GetType("Kavita.Services.Helpers.PdfMetadataExtractor")
    ?? throw new InvalidOperationException("PDF parser type missing.");
var tableReader = type.Methods.Single(m => m.Name == "ReadXRefAndTrailer");
var streamReader = type.Methods.Single(m => m.Name == "ReadXRefStream");
bool IsDictionaryMethod(Instruction i, string name) =>
    i.OpCode == OpCodes.Callvirt && i.Operand is MethodReference m && m.Name == name &&
    m.DeclaringType is GenericInstanceType g && g.ElementType.FullName == "System.Collections.Generic.Dictionary`2" &&
    g.GenericArguments.Count == 2 && g.GenericArguments.All(a => a.MetadataType == MetadataType.Int64);
var assignment = tableReader.Body.Instructions.Single(i => IsDictionaryMethod(i, "set_Item"));
// Reuse the same Dictionary<long,long>.TryAdd reference already used by the stream reader.
var tryAdd = (MethodReference)streamReader.Body.Instructions.Single(i => IsDictionaryMethod(i, "TryAdd")).Operand;
assignment.Operand = tryAdd;
tableReader.Body.GetILProcessor().InsertAfter(assignment, Instruction.Create(OpCodes.Pop));
// Both existing reader configurations should accept a missing EPUB 3 NAV item,
// while all manifest/spine/content checks retain their existing settings.
using var epub = resolver.Resolve(assembly.MainModule.AssemblyReferences.Single(a => a.Name == "VersOne.Epub"));
var options = epub.MainModule.GetType("VersOne.Epub.Options.EpubReaderOptions");
var getNavOptions = options.Methods.Single(m => m.Name == "get_Epub3NavDocumentReaderOptions");
var navOptions = epub.MainModule.GetType(getNavOptions.ReturnType.FullName);
var allowMissingNav = navOptions.Methods.Single(m => m.Name == "set_IgnoreMissingNavManifestItemError");
var bookService = assembly.MainModule.GetType("Kavita.Services.BookService");
var initializer = bookService.Methods.Single(m => m.Name == ".cctor");
var ret = initializer.Body.Instructions.Single(i => i.OpCode == OpCodes.Ret);
var il = initializer.Body.GetILProcessor();
foreach (var name in new[] { "BookReaderOptions", "LenientBookReaderOptions" })
{
    var field = bookService.Fields.Single(f => f.Name == name && f.IsStatic);
    il.InsertBefore(ret, Instruction.Create(OpCodes.Ldsfld, field));
    il.InsertBefore(ret, Instruction.Create(OpCodes.Callvirt, assembly.MainModule.ImportReference(getNavOptions)));
    il.InsertBefore(ret, Instruction.Create(OpCodes.Ldc_I4_1));
    il.InsertBefore(ret, Instruction.Create(OpCodes.Callvirt, assembly.MainModule.ImportReference(allowMissingNav)));
}
assembly.Write(args[1]);

using var check = AssemblyDefinition.ReadAssembly(args[1]);
var instructions = check.MainModule.GetType(type.FullName).Methods.Single(m => m.Name == tableReader.Name).Body.Instructions;
if (instructions.Any(i => IsDictionaryMethod(i, "set_Item")) || instructions.Count(i => IsDictionaryMethod(i, "TryAdd")) != 1)
    throw new InvalidOperationException("Patched method verification failed.");
Console.WriteLine("Patched classic xref reader and both EPUB reader configurations; remaining behavior unchanged.");
Console.WriteLine($"Patched SHA256: {Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(args[1]))).ToLowerInvariant()}");
