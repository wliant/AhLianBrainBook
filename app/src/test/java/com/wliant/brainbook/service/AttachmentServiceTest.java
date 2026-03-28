package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.AttachmentResponse;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.repository.AttachmentRepository;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.MinioClient;
import io.minio.ObjectWriteResponse;
import io.minio.PutObjectArgs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class AttachmentServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private AttachmentService attachmentService;

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private BrainRepository brainRepository;

    @Autowired
    private ClusterRepository clusterRepository;

    @Autowired
    private BrainService brainService;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private NeuronService neuronService;

    private UUID neuronId;

    @BeforeEach
    void setUp() throws Exception {
        attachmentRepository.deleteAll();
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();

        BrainResponse brain = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000"));
        ClusterResponse cluster = clusterService.create(new ClusterRequest("Test Cluster", brain.id(), null));
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Test Neuron", brain.id(), cluster.id(), null, null, null));
        neuronId = neuron.id();

        when(minioClient.putObject(any(PutObjectArgs.class)))
                .thenReturn(Mockito.mock(ObjectWriteResponse.class));
    }

    @Test
    void upload_savesAttachment() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.txt", "text/plain", "hello world".getBytes());

        AttachmentResponse response = attachmentService.upload(neuronId, file);

        assertThat(response.id()).isNotNull();
        assertThat(response.neuronId()).isEqualTo(neuronId);
        assertThat(response.fileName()).isEqualTo("test.txt");
        assertThat(response.fileSize()).isEqualTo(11L);
        assertThat(response.contentType()).isEqualTo("text/plain");
    }

    @Test
    void getByNeuronId_returnsAttachments() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.txt", "text/plain", "hello".getBytes());
        attachmentService.upload(neuronId, file);

        List<AttachmentResponse> attachments = attachmentService.getByNeuronId(neuronId);

        assertThat(attachments).hasSize(1);
        assertThat(attachments.get(0).fileName()).isEqualTo("test.txt");
    }

    @Test
    void delete_removesAttachment() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.txt", "text/plain", "hello".getBytes());
        AttachmentResponse uploaded = attachmentService.upload(neuronId, file);

        attachmentService.delete(uploaded.id());

        assertThat(attachmentRepository.findById(uploaded.id())).isEmpty();
    }
}
