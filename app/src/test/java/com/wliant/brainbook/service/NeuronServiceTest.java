package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class NeuronServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private NeuronService neuronService;

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

    private UUID brainId;
    private UUID clusterId;

    @BeforeEach
    void setUp() {
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();

        BrainResponse brain = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000", null));
        brainId = brain.id();

        ClusterResponse cluster = clusterService.create(new ClusterRequest("Test Cluster", brainId, null));
        clusterId = cluster.id();
    }

    @Test
    void create_savesNeuron() {
        NeuronRequest request = new NeuronRequest("Title", brainId, clusterId, null, null, null, null);
        NeuronResponse response = neuronService.create(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.title()).isEqualTo("Title");
        assertThat(response.brainId()).isEqualTo(brainId);
        assertThat(response.clusterId()).isEqualTo(clusterId);
        assertThat(response.version()).isEqualTo(1);
        assertThat(response.isFavorite()).isFalse();
        assertThat(response.isPinned()).isFalse();
        assertThat(response.isDeleted()).isFalse();
    }

    @Test
    void getByClusterId_returnsNeurons() {
        neuronService.create(new NeuronRequest("Neuron 1", brainId, clusterId, null, null, null, null));

        List<NeuronResponse> neurons = neuronService.getByClusterId(clusterId);

        assertThat(neurons).hasSize(1);
        assertThat(neurons.get(0).title()).isEqualTo("Neuron 1");
    }

    @Test
    void updateContent_incrementsVersion() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        NeuronResponse updated = neuronService.updateContent(created.id(),
                new NeuronContentRequest("{\"type\":\"doc\"}", "text content", 1));

        assertThat(updated.version()).isEqualTo(2);
        assertThat(updated.contentJson()).isEqualTo("{\"type\":\"doc\"}");
        assertThat(updated.contentText()).isEqualTo("text content");
    }

    @Test
    void updateContent_throwsOnVersionConflict() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        neuronService.updateContent(created.id(),
                new NeuronContentRequest("{}", "text", 1));

        assertThatThrownBy(() -> neuronService.updateContent(created.id(),
                new NeuronContentRequest("{}", "text", 1)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void delete_softDeletes() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        neuronService.delete(created.id());

        assertThat(neuronRepository.findById(created.id()).get().isDeleted()).isTrue();
    }

    @Test
    void restoreFromTrash_unsetsDeleted() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));
        neuronService.delete(created.id());

        NeuronResponse restored = neuronService.restoreFromTrash(created.id());

        assertThat(restored.isDeleted()).isFalse();
    }

    @Test
    void toggleFavorite_togglesFlag() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        NeuronResponse toggled = neuronService.toggleFavorite(created.id());

        assertThat(toggled.isFavorite()).isTrue();
    }

    @Test
    void togglePin_togglesFlag() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        NeuronResponse toggled = neuronService.togglePin(created.id());

        assertThat(toggled.isPinned()).isTrue();
    }
}
