package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.RevisionResponse;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.NeuronRevisionRepository;
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

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class RevisionServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private RevisionService revisionService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private NeuronRevisionRepository neuronRevisionRepository;

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
        neuronRevisionRepository.deleteAll();
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();

        BrainResponse brain = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000", null));
        brainId = brain.id();

        ClusterResponse cluster = clusterService.create(new ClusterRequest("Test Cluster", brainId, null));
        clusterId = cluster.id();
    }

    @Test
    void createRevision_savesSnapshot() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{\"doc\":true}", "some text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id(), "snapshot");

        assertThat(revision.id()).isNotNull();
        assertThat(revision.neuronId()).isEqualTo(neuron.id());
        assertThat(revision.revisionNumber()).isEqualTo(1);
        assertThat(revision.contentJson()).isEqualTo("{\"doc\": true}");
        assertThat(revision.contentText()).isEqualTo("some text");
    }

    @Test
    void getRevisions_returnsRevisions() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        revisionService.createRevision(neuron.id(), "first");
        revisionService.createRevision(neuron.id(), "second");

        List<RevisionResponse> revisions = revisionService.getRevisions(neuron.id());

        assertThat(revisions).hasSize(2);
    }

    @Test
    void restoreRevision_updatesNeuronContent() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{\"v\":1}", "original text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id(), "before change");

        neuronService.updateContent(neuron.id(),
                new NeuronContentRequest("{\"v\":2}", "changed text", 1));

        NeuronResponse restored = revisionService.restoreRevision(revision.id());

        assertThat(restored.contentJson()).isEqualTo("{\"v\": 1}");
        assertThat(restored.contentText()).isEqualTo("original text");
    }
}
