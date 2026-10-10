using System.IO.Compression;
using System.Text;
using VersOne.Epub;

namespace Kavita.Services.Tests.Helpers;

public class BookServiceEpubOptionsTests
{
    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public void OpenBook_PreservesReadingOrderWithOrWithoutNav(bool includeNav, bool lenient)
    {
        var path = Path.Combine(Path.GetTempPath(), $"kavita-nav-{Guid.NewGuid():N}.epub");
        try
        {
            using (var file = File.Create(path))
            using (var zip = new ZipArchive(file, ZipArchiveMode.Create))
            {
                void Entry(string name, string content)
                {
                    using var writer = new StreamWriter(zip.CreateEntry(name, CompressionLevel.NoCompression).Open(), new UTF8Encoding(false));
                    writer.Write(content);
                }
                Entry("mimetype", "application/epub+zip");
                Entry("META-INF/container.xml", "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles><rootfile full-path=\"book.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles></container>");
                var navItem = includeNav ? "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>" : "";
                Entry("book.opf", $"<package version=\"3.0\" unique-identifier=\"id\" xmlns=\"http://www.idpf.org/2007/opf\"><metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:identifier id=\"id\">test-comic</dc:identifier><dc:title>Test comic</dc:title><dc:language>zh-TW</dc:language><meta property=\"dcterms:modified\">2026-10-10T00:00:00Z</meta></metadata><manifest><item id=\"page1\" href=\"page1.xhtml\" media-type=\"application/xhtml+xml\"/><item id=\"page2\" href=\"page2.xhtml\" media-type=\"application/xhtml+xml\"/>{navItem}</manifest><spine><itemref idref=\"page1\"/><itemref idref=\"page2\"/></spine></package>");
                Entry("page1.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>1</title></head><body><p>Page one</p></body></html>");
                Entry("page2.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>2</title></head><body><p>Page two</p></body></html>");
                if (includeNav)
                    Entry("nav.xhtml", "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><head><title>Contents</title></head><body><nav epub:type=\"toc\"><ol><li><a href=\"page1.xhtml\">One</a></li><li><a href=\"page2.xhtml\">Two</a></li></ol></nav></body></html>");
            }
            using var book = EpubReader.OpenBook(path, lenient ? BookService.LenientBookReaderOptions : BookService.BookReaderOptions);
            Assert.NotNull(book);
            Assert.Equal("Test comic", book.Title);
            var readingOrder = book.GetReadingOrder();
            Assert.Equal(2, readingOrder.Count);
            Assert.Contains("Page one", readingOrder[0].ReadContentAsText());
            Assert.Contains("Page two", readingOrder[1].ReadContentAsText());
        }
        finally
        {
            File.Delete(path);
        }
    }
}
