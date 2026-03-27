package com.ahlian.brainbook.service;

import com.ahlian.brainbook.dto.AttachmentResponse;
import com.ahlian.brainbook.exception.ResourceNotFoundException;
import com.ahlian.brainbook.model.Attachment;
import com.ahlian.brainbook.model.Neuron;
import com.ahlian.brainbook.repository.AttachmentRepository;
import com.ahlian.brainbook.repository.NeuronRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final NeuronRepository neuronRepository;
    private final Path storagePath;

    public AttachmentService(AttachmentRepository attachmentRepository,
                             NeuronRepository neuronRepository,
                             @Value("${attachment.storage-path}") String storagePath) {
        this.attachmentRepository = attachmentRepository;
        this.neuronRepository = neuronRepository;
        this.storagePath = Paths.get(storagePath).toAbsolutePath().normalize();
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
            Files.createDirectories(storagePath);

            String storedFileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path targetPath = storagePath.resolve(storedFileName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            Attachment attachment = new Attachment();
            attachment.setNeuron(neuron);
            attachment.setFileName(file.getOriginalFilename());
            attachment.setFilePath(storedFileName);
            attachment.setFileSize(file.getSize());
            attachment.setContentType(file.getContentType());

            Attachment saved = attachmentRepository.save(attachment);
            return toResponse(saved);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    public Resource download(UUID id) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found: " + id));

        try {
            Path filePath = storagePath.resolve(attachment.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) {
                throw new ResourceNotFoundException("File not found on disk: " + id);
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new RuntimeException("Failed to read file", e);
        }
    }

    public void delete(UUID id) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found: " + id));

        try {
            Path filePath = storagePath.resolve(attachment.getFilePath()).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // Log but don't fail -- DB record removal is more important
        }

        attachmentRepository.delete(attachment);
    }

    private AttachmentResponse toResponse(Attachment attachment) {
        AttachmentResponse resp = new AttachmentResponse();
        resp.setId(attachment.getId());
        resp.setNeuronId(attachment.getNeuronId());
        resp.setFilename(attachment.getFileName());
        resp.setMimeType(attachment.getContentType());
        resp.setSizeBytes(attachment.getFileSize());
        resp.setCreatedAt(attachment.getCreatedAt());
        return resp;
    }
}
