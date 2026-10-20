import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main


class FakeTokenizer:
    def __init__(self):
        self.max_input_chars = 0

    def encode(self, text, add_special_tokens=False):
        self.max_input_chars = max(self.max_input_chars, len(text))
        return text.split()

    def decode(self, tokens, skip_special_tokens=True):
        return " ".join(tokens)


class FakeSummarizer:
    tokenizer = FakeTokenizer()

    def __call__(self, text, **kwargs):
        return [{"summary_text": "A generated summary of this source."}]


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_does_not_load_model(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["model_loaded"])

    def test_rejects_insufficient_text(self):
        response = self.client.post("/api/summarize", json={"text": "Too few words here."})
        self.assertEqual(response.status_code, 422)

    def test_long_text_is_tokenized_in_bounded_windows(self):
        tokenizer = FakeTokenizer()
        text = "x " * 1200
        chunks = main.split_text(text, tokenizer)
        self.assertGreater(len(chunks), 1)
        self.assertLessEqual(tokenizer.max_input_chars, 256)
        self.assertEqual(sum(len(chunk.split()) for chunk in chunks), 1200)

    def test_summarize_returns_statistics(self):
        main.get_summarizer.cache_clear()
        text = " ".join(f"word{i}" for i in range(60))
        with patch.object(main, "get_summarizer", return_value=FakeSummarizer()):
            response = self.client.post("/api/summarize", json={"text": text, "length": "short"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["summary"], "A generated summary of this source.")
        self.assertEqual(data["original_word_count"], 60)
        self.assertEqual(data["summary_word_count"], 6)
        self.assertEqual(data["compression_percent"], 90.0)

    def test_upload_rejects_unsupported_extension(self):
        response = self.client.post("/api/extract-text", files={"file": ("notes.docx", b"text")})
        self.assertEqual(response.status_code, 415)

    def test_upload_reports_empty_text(self):
        response = self.client.post("/api/extract-text", files={"file": ("empty.txt", b"  ")})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
