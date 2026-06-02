import fitz  # PyMuPDF


def parse_pdf(file_bytes: bytes) -> dict:
    """
    Extract text from PDF bytes, returns text per page.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    full_text = []

    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        pages.append({"page": i + 1, "text": text})
        full_text.append(text)

    doc.close()
    return {
        "text": "\n\n".join(full_text),
        "pages": pages,
        "num_pages": len(pages)
    }
