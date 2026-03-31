package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.RevisionResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
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
class RevisionServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private RevisionService revisionService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID brainId;
    private UUID clusterId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        BrainResponse brain = testDataFactory.createBrain();
        brainId = brain.id();
        ClusterResponse cluster = testDataFactory.createCluster(brainId);
        clusterId = cluster.id();
    }

    @Test
    void createRevision_savesSnapshot() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{\"doc\":true}", "some text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id());

        assertThat(revision.id()).isNotNull();
        assertThat(revision.neuronId()).isEqualTo(neuron.id());
        assertThat(revision.revisionNumber()).isEqualTo(1);
        assertThat(revision.contentJson()).isEqualTo("{\"doc\": true}");
        assertThat(revision.contentText()).isEqualTo("some text");
    }

    @Test
    void createRevision_savesNeuronTitle() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("My Important Note", brainId, clusterId, "{}", "text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id());

        assertThat(revision.title()).isEqualTo("My Important Note");
    }

    @Test
    void createRevision_enforcesMaxLimit() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        // Create 10 revisions (the max)
        for (int i = 0; i < 10; i++) {
            revisionService.createRevision(neuron.id());
        }
        assertThat(revisionService.getRevisions(neuron.id())).hasSize(10);

        // Creating an 11th should delete the oldest
        RevisionResponse eleventh = revisionService.createRevision(neuron.id());

        List<RevisionResponse> revisions = revisionService.getRevisions(neuron.id());
        assertThat(revisions).hasSize(10);
        // Oldest (revision #1) should be gone, newest should be present
        assertThat(revisions.stream().map(RevisionResponse::revisionNumber))
                .doesNotContain(1)
                .contains(eleventh.revisionNumber());
    }

    @Test
    void getRevisions_returnsRevisions() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        revisionService.createRevision(neuron.id());
        revisionService.createRevision(neuron.id());

        List<RevisionResponse> revisions = revisionService.getRevisions(neuron.id());

        assertThat(revisions).hasSize(2);
    }

    @Test
    void deleteRevision_removesRevision() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id());
        assertThat(revisionService.getRevisions(neuron.id())).hasSize(1);

        revisionService.deleteRevision(revision.id());

        assertThat(revisionService.getRevisions(neuron.id())).isEmpty();
    }

    @Test
    void deleteRevision_throwsForNonexistent() {
        UUID nonexistentId = UUID.randomUUID();

        assertThatThrownBy(() -> revisionService.deleteRevision(nonexistentId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void restoreRevision_updatesNeuronContent() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{\"v\":1}", "original text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id());

        neuronService.updateContent(neuron.id(),
                new NeuronContentRequest("{\"v\":2}", "changed text", 1));

        NeuronResponse restored = revisionService.restoreRevision(revision.id());

        assertThat(restored.contentJson()).isEqualTo("{\"v\": 1}");
        assertThat(restored.contentText()).isEqualTo("original text");
    }

    @Test
    void restoreRevision_incrementsVersion() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        RevisionResponse revision = revisionService.createRevision(neuron.id());

        NeuronResponse restored = revisionService.restoreRevision(revision.id());

        assertThat(restored.version()).isEqualTo(neuron.version() + 1);
    }

    @Test
    void getRevision_returnsSingleRevision() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{\"k\":1}", "text", null, null));

        RevisionResponse created = revisionService.createRevision(neuron.id());
        RevisionResponse fetched = revisionService.getRevision(created.id());

        assertThat(fetched.id()).isEqualTo(created.id());
        assertThat(fetched.neuronId()).isEqualTo(neuron.id());
        assertThat(fetched.revisionNumber()).isEqualTo(1);
        assertThat(fetched.title()).isEqualTo("Title");
    }

    @Test
    void getRevision_throwsForNonexistent() {
        assertThatThrownBy(() -> revisionService.getRevision(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getRevisions_returnsNewestFirst() {
        NeuronResponse neuron = neuronService.create(
                new NeuronRequest("Title", brainId, clusterId, "{}", "text", null, null));

        revisionService.createRevision(neuron.id());
        revisionService.createRevision(neuron.id());
        revisionService.createRevision(neuron.id());

        List<RevisionResponse> revisions = revisionService.getRevisions(neuron.id());

        assertThat(revisions).hasSize(3);
        assertThat(revisions.get(0).revisionNumber()).isEqualTo(3);
        assertThat(revisions.get(1).revisionNumber()).isEqualTo(2);
        assertThat(revisions.get(2).revisionNumber()).isEqualTo(1);
    }

    @Test
    void restoreRevision_throwsForNonexistentRevision() {
        assertThatThrownBy(() -> revisionService.restoreRevision(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
