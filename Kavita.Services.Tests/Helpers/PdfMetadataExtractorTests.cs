using System.Text;
using Kavita.API.Services;
using Kavita.Services.Helpers;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kavita.Services.Tests.Helpers;

public class PdfMetadataExtractorTests
{
    [Theory]
    [InlineData(0, "Original Series", "1")]
    [InlineData(1, "Updated Series", "2")]
    [InlineData(2, "Latest Series", "3")]
    public void GetMetadata_PrefersNewestObjectsAcrossIncrementalUpdates(int updates, string series, string volume)
    {
        var path = Path.Combine(Path.GetTempPath(), $"kavita-xref-{Guid.NewGuid():N}.pdf");
        try
        {
            File.WriteAllBytes(path, CreatePdf(updates));
            using var extractor = new PdfMetadataExtractor(NullLogger<IBookService>.Instance, path);
            var metadata = extractor.GetMetadata();

            Assert.Equal(series, metadata["Series"]);
            Assert.Equal(volume, metadata["Volume"]);
            // The latest subsection omits the Info object: older sections must still supply it.
            Assert.Equal("Original title", metadata["Title"]);
        }
        finally
        {
            File.Delete(path);
        }
    }

    private static byte[] CreatePdf(int updates)
    {
        using var stream = new MemoryStream();
        void Write(string text) => stream.Write(Encoding.UTF8.GetBytes(text));
        long Object(int id, string body)
        {
            var offset = stream.Position;
            Write($"{id} 0 obj\n{body}\nendobj\n");
            return offset;
        }
        long Metadata(int id, string series, int volume)
        {
            var xml = $"<?xpacket begin=\"\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?><x:xmpmeta xmlns:x=\"adobe:ns:meta/\"><rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><rdf:Description xmlns:calibre=\"http://calibre-ebook.com/xmp-namespace\" xmlns:calibreSI=\"http://calibre-ebook.com/xmp-namespace-series-index\"><calibre:series><rdf:value>{series}</rdf:value></calibre:series><calibreSI:series_index>{volume}</calibreSI:series_index></rdf:Description></rdf:RDF></x:xmpmeta>";
            return Object(id, $"<< /Type /Metadata /Subtype /XML /Length {Encoding.UTF8.GetByteCount(xml)} >>\nstream\n{xml}\nendstream");
        }

        Write("%PDF-1.7\n");
        var root = Object(1, "<< /Type /Catalog /Metadata 2 0 R >>");
        var metadata = Metadata(2, "Original Series", 1);
        var info = Object(3, "<< /Title (Original title) >>");
        var previous = stream.Position;
        Write($"xref\n0 4\n0000000000 65535 f \n{root:0000000000} 00000 n \n{metadata:0000000000} 00000 n \n{info:0000000000} 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R /Info 3 0 R >>\nstartxref\n{previous}\n%%EOF\n");

        for (var update = 1; update <= updates; update++)
        {
            // First update introduces a new metadata object; later updates reuse that object.
            root = Object(1, "<< /Type /Catalog /Metadata 4 0 R >>");
            metadata = Metadata(4, update == 1 ? "Updated Series" : "Latest Series", update + 1);
            var current = stream.Position;
            Write($"xref\n1 1\n{root:0000000000} 00000 n \n4 1\n{metadata:0000000000} 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R /Info 3 0 R /Prev {previous} >>\nstartxref\n{current}\n%%EOF\n");
            previous = current;
        }

        return stream.ToArray();
    }
}
