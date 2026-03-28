package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.AttachmentResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Attachment;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.AttachmentRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AttachmentService {

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

        try {
            String objectKey = UUID.randomUUID() + "_" + file.getOriginalFilename();

            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());

            Attachment attachment = new Attachment();
            attachment.setNeuron(neuron);
            attachment.setFileName(file.getOriginalFilename());
            attachment.setFilePath(objectKey);
            attachment.setFileSize(file.getSize());
            attachment.setContentType(file.getContentType());

            Attachment saved = attachmentRepository.save(attachment);
            return toResponse(saved);
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file in MinIO", e);
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
            throw new RuntimeException("Failed to read file from MinIO", e);
        }
    }

    public void delete(UUID id) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found: " + id));

        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(attachment.getFilePath())
                    .build());
        } catch (Exception e) {
            // Log but don't fail -- DB record removal is more important
        }

        attachmentRepository.delete(attachment);
    }

    private AttachmentResponse toResponse(Attachment attachment) {
        return new AttachmentResponse(
                attachment.getId(),
                attachment.getNeuronId(),
                attachment.getFileName(),
                attachment.getFilePath(),
                attachment.getFileSize(),
                attachment.getContentType(),
                attachment.getCreatedAt()
        );
    }
}
