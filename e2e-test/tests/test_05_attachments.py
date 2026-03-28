"""E2E tests for Attachments with MinIO verification."""

import pytest

from helpers.api_client import BrainBookAPI
from helpers.minio_client import MinIOHelper


class TestAttachmentUploadAndDownload:
    def test_upload_file_and_verify_in_minio(self, api: BrainBookAPI, minio: MinIOHelper, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        file_content = b"Hello from E2E test!"
        filename = "test-file.txt"

        attachment = api.upload_attachment(neuron["id"], filename, file_content, "text/plain")

        assert attachment["fileName"] == filename
        assert attachment["contentType"] == "text/plain"
        assert attachment["fileSize"] == len(file_content)

        # Verify file exists in MinIO
        file_path = attachment["filePath"]
        assert minio.object_exists(file_path), f"File {file_path} not found in MinIO"

        # Verify content matches
        minio_content = minio.get_object_content(file_path)
        assert minio_content == file_content

        # Clean up
        api.delete_attachment(attachment["id"])

    def test_download_file_matches_upload(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        file_content = b"Download test content 12345"
        filename = "download-test.txt"

        attachment = api.upload_attachment(neuron["id"], filename, file_content, "text/plain")

        try:
            downloaded = api.download_attachment(attachment["id"])
            assert downloaded == file_content
        finally:
            api.delete_attachment(attachment["id"])

    def test_list_attachments(self, api: BrainBookAPI, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        a1 = api.upload_attachment(neuron["id"], "file1.txt", b"content1", "text/plain")
        a2 = api.upload_attachment(neuron["id"], "file2.txt", b"content2", "text/plain")

        try:
            attachments = api.list_attachments(neuron["id"])
            ids = [a["id"] for a in attachments]
            assert a1["id"] in ids
            assert a2["id"] in ids
        finally:
            api.delete_attachment(a1["id"])
            api.delete_attachment(a2["id"])

    def test_delete_attachment_removes_from_minio(self, api: BrainBookAPI, minio: MinIOHelper, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        attachment = api.upload_attachment(neuron["id"], "deleteme.txt", b"temp", "text/plain")

        file_path = attachment["filePath"]
        assert minio.object_exists(file_path)

        api.delete_attachment(attachment["id"])

        assert not minio.object_exists(file_path), "File should be removed from MinIO after delete"

    def test_upload_binary_file(self, api: BrainBookAPI, minio: MinIOHelper, neuron_in_cluster):
        _, _, neuron = neuron_in_cluster
        # Create a small PNG-like binary
        png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        filename = "test-image.png"

        attachment = api.upload_attachment(neuron["id"], filename, png_header, "image/png")

        try:
            assert attachment["contentType"] == "image/png"
            assert attachment["fileSize"] == len(png_header)

            # Verify in MinIO
            assert minio.object_exists(attachment["filePath"])
            minio_content = minio.get_object_content(attachment["filePath"])
            assert minio_content == png_header
        finally:
            api.delete_attachment(attachment["id"])


class TestMinIOBucket:
    def test_bucket_exists(self, minio: MinIOHelper):
        assert minio.bucket_exists(), "brainbook-attachments bucket should exist"
