import io
import openpyxl
import docx2txt
import pypdf
from parsers import parse_document
from rag_engine import DocumentStore

def test_excel_parsing():
    print("[1/4] Testing Excel (.xlsx & .xlsm) parsing...")
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Sales Q3"
    ws1.append(["Product", "Revenue", "Margin"])
    ws1.append(["Widget A", 50000, "25%"])
    ws1.append(["Widget B", 85000, "32%"])
    
    ws2 = wb.create_sheet(title="Personnel")
    ws2.append(["Department", "Headcount", "Lead"])
    ws2.append(["Engineering", 42, "Sarah Connor"])
    ws2.append(["Research", 18, "Alan Turing"])

    bio = io.BytesIO()
    wb.save(bio)
    excel_bytes = bio.getvalue()

    result = parse_document(excel_bytes, "quarterly_financials.xlsm")
    assert "Sales Q3" in result["text"], "Sales Q3 sheet missing"
    assert "Alan Turing" in result["text"], "Personnel data missing"
    assert result["metadata"]["type"] == "Excel Macro-Enabled Workbook (.xlsm)"
    print("  [OK] Excel parsing passed!")

def test_pdf_parsing():
    print("[2/4] Testing PDF parsing...")
    # Create simple PDF in memory using pypdf Writer
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    # We can write minimal metadata or text
    bio = io.BytesIO()
    writer.write(bio)
    pdf_bytes = bio.getvalue()
    result = parse_document(pdf_bytes, "document.pdf")
    assert result["metadata"]["type"] == "PDF Document"
    print("  [OK] PDF parsing structure passed!")

def test_text_and_rag():
    print("[3/4] Testing Text parsing and RAG citation retrieval...")
    sample_text = """
    Project Apollo was the third United States human spaceflight program carried out by NASA.
    First conceived during Dwight D. Eisenhower's administration, Apollo was dedicated to landing
    humans on the Moon and bringing them safely back to Earth.

    The Saturn V was an American human-rated super heavy-lift launch vehicle used by NASA between
    1967 and 1973. It remains the only launch vehicle to have carried humans beyond low Earth orbit.
    """
    result = parse_document(sample_text.encode("utf-8"), "apollo.txt")
    doc_store = DocumentStore()
    summary = doc_store.load_document("apollo.txt", result)
    assert summary["total_chunks"] > 0
    
    # Query Apollo
    answer = doc_store.answer_question("What was the Saturn V rocket?")
    assert len(answer["citations"]) > 0
    assert "Saturn V" in answer["citations"][0]["text"]
    print("  [OK] RAG indexing and citation retrieval passed!")

def test_csv_parsing():
    print("[4/4] Testing CSV parsing...")
    csv_data = b"ID,Name,Department\n1,Alice,AI Lab\n2,Bob,Cloud Ops"
    result = parse_document(csv_data, "team.csv")
    assert "Alice" in result["text"]
    print("  [OK] CSV parsing passed!")

if __name__ == "__main__":
    test_excel_parsing()
    test_pdf_parsing()
    test_text_and_rag()
    test_csv_parsing()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
