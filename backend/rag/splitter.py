from langchain.text_splitter import RecursiveCharacterTextSplitter


def split_text(text: str, chunk_size: int = 512, chunk_overlap: int = 64) -> list[dict]:
    """
    Split text using LangChain's RecursiveCharacterTextSplitter.
    Returns list of chunks with index metadata.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    chunks = splitter.split_text(text)
    return [{"id": i, "text": chunk} for i, chunk in enumerate(chunks)]
