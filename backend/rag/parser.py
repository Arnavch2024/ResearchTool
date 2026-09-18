import fitz  # PyMuPDF


def parse_pdf(file_bytes: bytes) -> dict:
    """
    Extract text from PDF bytes and detect visual elements (images, drawings).

    Returns:
        dict with keys:
            text         – full concatenated text
            pages        – list of {page, text} per page
            num_pages    – total page count
            has_visuals  – True if images or significant drawings detected
            visual_stats – breakdown of visual elements found
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    full_text = []

    total_images = 0
    total_drawings = 0
    pages_with_images = []

    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        pages.append({"page": i + 1, "text": text})
        full_text.append(text)

        # Detect raster images (embedded PNGs, JPEGs, etc.)
        images = page.get_images(full=True)
        img_count = len(images)
        total_images += img_count

        # Detect vector drawings (diagrams, flowcharts, shapes)
        try:
            drawings = page.get_drawings()
            # Only count pages with substantial drawings (>10 paths = likely a diagram,
            # not just simple lines/borders)
            drawing_count = len(drawings) if len(drawings) > 10 else 0
        except Exception:
            drawing_count = 0
        total_drawings += drawing_count

        if img_count > 0 or drawing_count > 0:
            pages_with_images.append(i + 1)

    doc.close()

    # A PDF "has visuals" if it contains any embedded images
    # or substantial vector drawings (diagrams)
    has_visuals = total_images > 0 or total_drawings > 50

    return {
        "text": "\n\n".join(full_text),
        "pages": pages,
        "num_pages": len(pages),
        "has_visuals": has_visuals,
        "visual_stats": {
            "total_images": total_images,
            "pages_with_images": pages_with_images,
            "total_drawings": total_drawings,
        },
    }
