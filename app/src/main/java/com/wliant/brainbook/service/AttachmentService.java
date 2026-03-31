package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.AttachmentResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.exception.StorageException;
import com.wliant.brainbook.model.Attachment;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.AttachmentRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
            ".sh", ".bash", ".csh", ".ps1", ".vbs", ".js", ".wsh", ".wsf"
    );

    private final AttachmentRepository attachmentRepository;
    private final NeuronRepository neuronRepository;
    private final MinioClient minioClient;
    private final String bucket;

    public AttachmentService(AttachmentRepository attachmentRepository,
                             NeuronRepository neuronRepository,
                             MinioClient minioClient,
                             @Value("${minio.bucket}") String bucket) {
        this.attachmentRepository = attachmentRepository;
        this.neuronRepository = neuronRepository;
        this.minioClient = minioClient;
        this.bucket = bucket;
    }

    public List<AttachmentResponse> getByNeuronId(UUID neuronId) {
        return attachmentRepository.findByNeuronId(neuronId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public AttachmentResponse upload(UUID neuronId, MultipartFile file) {
        Neuron neuron = neuronRepository.findById(neuronId)
                .orElseThrow(() -> new ResourceNotFoundException("Neuron not found: " + neuronId));

        String fileName = file.getOriginalFilename();
        validateFile(fileName, file.getSize());

        String sanitizedName = sanitizeFileName(fileName);

        String objectKey = UUID.randomUUID() + "_" + sanitizedName;
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        } catch (Exception e) {
            throw new StorageException("Failed to store file in MinIO", e);
        }

        try {
            Attachment attachment = new Attachment();
            attachment.setNeuron(neuron);
            attachment.setFileName(sanitizedName);
            attachment.setFilePath(objectKey);
            attachment.setFileSize(file.getSize());
            attachment.setContentType(file.getContentType());

            Attachment saved = attachmentRepository.save(attachment);
            return toResponse(saved);
        } catch (Exception e) {
            // DB save failed - clean up orphaned file in MinIO
            try {
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(bucket).object(objectKey).build());
            } catch (Exception cleanupEx) {
                log.error("Failed to clean up orphaned MinIO object (key={}): {}", objectKey, cleanupEx.getMessage());
            }
            throw new StorageException("Failed to save attachment record", e);
        }
    }

    public Resource download(UUID id) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found: " + id));

        try {
            InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(attachment.getFilePath())
                    .build());
            return new InputStreamResource(stream);
        } catch (Exception e) {
            throw new StorageException("Failed to read file from MinIO", e);
        }
    }

    public void delete(UUID id) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found: " + id));

        String filePath = attachment.getFilePath();
        attachmentRepository.delete(attachment);

        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(filePath)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to delete file from MinIO (key={}): {}. Orphaned file may remain.", filePath, e.getMessage());
        }
    }

    private void validateFile(String fileName, long fileSize) {
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("File name is required");
        }
        if (fileSize <= 0) {
            throw new IllegalArgumentException("File is empty");
        }
        if (fileSize > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum of 50MB");
        }
        String lowerName = fileName.toLowerCase();
        for (String ext : BLOCKED_EXTENSIONS) {
            if (lowerName.endsWith(ext)) {
                throw new IllegalArgumentException("File type not allowed: " + ext);
            }
        }
    }

    private String sanitizeFileName(String fileName) {
        // Strip path separators to prevent path traversal
        String name = fileName.replace("/", "").replace("\\", "");
        // Remove null bytes and other control characters
        name = name.replaceAll("[\\x00-\\x1f]", "");
        if (name.isBlank()) {
            throw new IllegalArgumentException("File name is invalid after sanitization");
        }
        return name;
    }

    private AttachmentResponse toResponse(Attachment attachment) {
        return new AttachmentResponse(
                attachment.getId(),
                attachment.getNeuron() != null ? attachment.getNeuron().getId() : attachment.getNeuronId(),
                attachment.getFileName(),
                attachment.getFilePath(),
                attachment.getFileSize(),
                attachment.getContentType(),
                attachment.getCreatedAt()
        );
    }
}
