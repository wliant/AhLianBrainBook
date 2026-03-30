package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.repository.ClusterRepository;
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
class ClusterServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private ClusterRepository clusterRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID brainId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        BrainResponse brain = testDataFactory.createBrain();
        brainId = brain.id();
    }

    @Test
    void create_savesClusterUnderBrain() {
        ClusterRequest request = new ClusterRequest("Test Cluster", brainId, null);
        ClusterResponse response = clusterService.create(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("Test Cluster");
        assertThat(response.brainId()).isEqualTo(brainId);
        assertThat(response.parentClusterId()).isNull();
        assertThat(response.isArchived()).isFalse();
    }

    @Test
    void getByBrainId_returnsClusters() {
        clusterService.create(new ClusterRequest("Cluster 1", brainId, null));

        List<ClusterResponse> clusters = clusterService.getByBrainId(brainId);

        assertThat(clusters).hasSize(1);
        assertThat(clusters.get(0).name()).isEqualTo("Cluster 1");
    }

    @Test
    void update_modifiesCluster() {
        ClusterResponse created = clusterService.create(new ClusterRequest("Original", brainId, null));

        ClusterResponse updated = clusterService.update(created.id(), new ClusterRequest("Updated", brainId, null));

        assertThat(updated.name()).isEqualTo("Updated");
        assertThat(updated.id()).isEqualTo(created.id());
    }

    @Test
    void delete_removesCluster() {
        ClusterResponse created = clusterService.create(new ClusterRequest("To Delete", brainId, null));

        clusterService.delete(created.id());

        assertThat(clusterRepository.findById(created.id())).isEmpty();
    }

    @Test
    void archive_setsArchived() {
        ClusterResponse created = clusterService.create(new ClusterRequest("To Archive", brainId, null));

        ClusterResponse archived = clusterService.archive(created.id());

        assertThat(archived.isArchived()).isTrue();
    }

    @Test
    void restore_unsetsArchived() {
        ClusterResponse created = clusterService.create(new ClusterRequest("To Restore", brainId, null));
        clusterService.archive(created.id());

        ClusterResponse restored = clusterService.restore(created.id());

        assertThat(restored.isArchived()).isFalse();
    }

    @Test
    void getById_returnsCluster() {
        ClusterResponse created = clusterService.create(new ClusterRequest("Test", brainId, null));

        ClusterResponse found = clusterService.getById(created.id());

        assertThat(found.id()).isEqualTo(created.id());
        assertThat(found.name()).isEqualTo("Test");
    }

    @Test
    void getById_throwsWhenNotFound() {
        assertThatThrownBy(() -> clusterService.getById(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void move_changesBrain() {
        ClusterResponse created = clusterService.create(new ClusterRequest("To Move", brainId, null));
        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");

        ClusterResponse moved = clusterService.move(created.id(), brain2.id());

        assertThat(moved.brainId()).isEqualTo(brain2.id());
    }

    @Test
    void move_throwsOnNonexistentBrain() {
        ClusterResponse created = clusterService.create(new ClusterRequest("Test", brainId, null));

        assertThatThrownBy(() -> clusterService.move(created.id(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void reorder_updatesSortOrders() {
        ClusterResponse c1 = clusterService.create(new ClusterRequest("A", brainId, null));
        ClusterResponse c2 = clusterService.create(new ClusterRequest("B", brainId, null));
        ClusterResponse c3 = clusterService.create(new ClusterRequest("C", brainId, null));

        clusterService.reorder(new ReorderRequest(List.of(c3.id(), c1.id(), c2.id())));

        List<ClusterResponse> reordered = clusterService.getByBrainId(brainId);
        assertThat(reordered.get(0).name()).isEqualTo("C");
        assertThat(reordered.get(1).name()).isEqualTo("A");
        assertThat(reordered.get(2).name()).isEqualTo("B");
    }
}
