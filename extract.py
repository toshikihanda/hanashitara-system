import PyPDF2

def extract_text(pdf_path):
    text = ""
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    
    with open("pdf_text.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("PDF Extracted Space to pdf_text.txt")

extract_text("ハナシタラ.com要件定義.pdf")
