package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.MoveNeuronRequest;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ConflictException;
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

    @Test
    void update_modifiesTitle() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Original", brainId, clusterId, null, null, null, null));

        NeuronResponse updated = neuronService.update(created.id(), new NeuronRequest("Updated", null, null, null, null, null, null));

        assertThat(updated.title()).isEqualTo("Updated");
    }

    @Test
    void update_modifiesComplexity() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        NeuronResponse updated = neuronService.update(created.id(), new NeuronRequest(null, null, null, null, null, null, "moderate"));

        assertThat(updated.complexity()).isEqualTo("moderate");
    }

    @Test
    void archive_setsArchived() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        NeuronResponse archived = neuronService.archive(created.id());

        assertThat(archived.isArchived()).isTrue();
    }

    @Test
    void restore_unsetsArchived() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));
        neuronService.archive(created.id());

        NeuronResponse restored = neuronService.restore(created.id());

        assertThat(restored.isArchived()).isFalse();
    }

    @Test
    void move_changesCluster() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));
        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");
        ClusterResponse cluster2 = testDataFactory.createCluster(brain2.id());

        NeuronResponse moved = neuronService.move(created.id(), new MoveNeuronRequest(cluster2.id(), brain2.id()));

        assertThat(moved.brainId()).isEqualTo(brain2.id());
        assertThat(moved.clusterId()).isEqualTo(cluster2.id());
    }

    @Test
    void duplicate_createsNewNeuron() {
        NeuronResponse created = neuronService.create(
                new NeuronRequest("My Note", brainId, clusterId, "{\"doc\":true}", "text", null, null));

        NeuronResponse copy = neuronService.duplicate(created.id());

        assertThat(copy.id()).isNotEqualTo(created.id());
        assertThat(copy.title()).isEqualTo("My Note (copy)");
        assertThat(copy.isFavorite()).isFalse();
        assertThat(copy.isPinned()).isFalse();
    }

    @Test
    void reorder_updatesSortOrders() {
        NeuronResponse n1 = neuronService.create(new NeuronRequest("A", brainId, clusterId, null, null, null, null));
        NeuronResponse n2 = neuronService.create(new NeuronRequest("B", brainId, clusterId, null, null, null, null));
        NeuronResponse n3 = neuronService.create(new NeuronRequest("C", brainId, clusterId, null, null, null, null));

        neuronService.reorder(new ReorderRequest(List.of(n3.id(), n1.id(), n2.id())));

        List<NeuronResponse> reordered = neuronService.getByClusterId(clusterId);
        assertThat(reordered.get(0).title()).isEqualTo("C");
        assertThat(reordered.get(1).title()).isEqualTo("A");
        assertThat(reordered.get(2).title()).isEqualTo("B");
    }

    @Test
    void permanentDelete_removesFromDatabase() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Title", brainId, clusterId, null, null, null, null));

        neuronService.permanentDelete(created.id());

        assertThat(neuronRepository.findById(created.id())).isEmpty();
    }

    @Test
    void getRecent_returnsLatestNeurons() {
        neuronService.create(new NeuronRequest("Note 1", brainId, clusterId, null, null, null, null));
        neuronService.create(new NeuronRequest("Note 2", brainId, clusterId, null, null, null, null));

        List<NeuronResponse> recent = neuronService.getRecent(2);

        assertThat(recent).hasSize(2);
    }

    @Test
    void getFavorites_returnsFavoriteNeurons() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Fav", brainId, clusterId, null, null, null, null));
        neuronService.toggleFavorite(created.id());

        List<NeuronResponse> favorites = neuronService.getFavorites();

        assertThat(favorites).hasSize(1);
        assertThat(favorites.get(0).title()).isEqualTo("Fav");
    }

    @Test
    void getPinned_returnsPinnedNeurons() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Pinned", brainId, clusterId, null, null, null, null));
        neuronService.togglePin(created.id());

        List<NeuronResponse> pinned = neuronService.getPinned();

        assertThat(pinned).hasSize(1);
        assertThat(pinned.get(0).title()).isEqualTo("Pinned");
    }

    @Test
    void getTrash_returnsDeletedNeurons() {
        NeuronResponse created = neuronService.create(new NeuronRequest("Trash", brainId, clusterId, null, null, null, null));
        neuronService.delete(created.id());

        List<NeuronResponse> trash = neuronService.getTrash();

        assertThat(trash).hasSize(1);
        assertThat(trash.get(0).title()).isEqualTo("Trash");
    }
}
