from langchain.text_splitter import RecursiveCharacterTextSplitter


def split_text(text: str, chunk_size: int = 1100, chunk_overlap: int = 150) -> list[dict]:
    """
    Split text using LangChain's RecursiveCharacterTextSplitter.
    Returns list of chunks with index metadata.

    Chunk size is tuned for research papers: ~1100 characters keeps a full
    paragraph or method step together (so citations and equations stay with
    their surrounding explanation), while the larger overlap preserves
    continuity across boundaries.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    chunks = splitter.split_text(text)
    return [{"id": i, "text": chunk} for i, chunk in enumerate(chunks)]
