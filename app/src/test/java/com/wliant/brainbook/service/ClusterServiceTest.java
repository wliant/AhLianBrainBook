package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.UpdateClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.ReorderRequest;
import com.wliant.brainbook.exception.ConflictException;
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
    void create_defaultsToKnowledgeType() {
        ClusterResponse response = clusterService.create(new CreateClusterRequest("Test Cluster", brainId, null, null, null));

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("Test Cluster");
        assertThat(response.brainId()).isEqualTo(brainId);
        assertThat(response.type()).isEqualTo("knowledge");
        assertThat(response.isArchived()).isFalse();
    }

    @Test
    void create_withAiResearchType_savesType() {
        ClusterResponse response = clusterService.create(new CreateClusterRequest("Research", brainId, "ai-research", null, null));

        assertThat(response.type()).isEqualTo("ai-research");
    }

    @Test
    void create_rejectsSecondAiResearchCluster() {
        clusterService.create(new CreateClusterRequest("Research 1", brainId, "ai-research", null, null));

        assertThatThrownBy(() -> clusterService.create(new CreateClusterRequest("Research 2", brainId, "ai-research", null, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Only one ai-research cluster");
    }

    @Test
    void create_allowsMultipleProjectClusters() {
        ClusterResponse p1 = clusterService.create(new CreateClusterRequest("Project 1", brainId, "project", "https://github.com/user/repo1.git", null));
        ClusterResponse p2 = clusterService.create(new CreateClusterRequest("Project 2", brainId, "project", "https://github.com/user/repo2.git", null));

        assertThat(p1.id()).isNotEqualTo(p2.id());
        assertThat(p1.type()).isEqualTo("project");
        assertThat(p2.type()).isEqualTo("project");
    }

    @Test
    void create_allowsAiResearchAfterArchivingExisting() {
        ClusterResponse first = clusterService.create(new CreateClusterRequest("Research 1", brainId, "ai-research", null, null));
        clusterService.archive(first.id());

        ClusterResponse second = clusterService.create(new CreateClusterRequest("Research 2", brainId, "ai-research", null, null));

        assertThat(second.type()).isEqualTo("ai-research");
    }

    @Test
    void create_allowsMultipleKnowledgeClusters() {
        clusterService.create(new CreateClusterRequest("K1", brainId, "knowledge", null, null));
        ClusterResponse k2 = clusterService.create(new CreateClusterRequest("K2", brainId, "knowledge", null, null));

        assertThat(k2.type()).isEqualTo("knowledge");
    }

    @Test
    void getByBrainId_returnsClusters() {
        clusterService.create(new CreateClusterRequest("Cluster 1", brainId, null, null, null));

        List<ClusterResponse> clusters = clusterService.getByBrainId(brainId);

        assertThat(clusters).hasSize(1);
        assertThat(clusters.get(0).name()).isEqualTo("Cluster 1");
    }

    @Test
    void update_modifiesNameOnly() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("Original", brainId, null, null, null));

        ClusterResponse updated = clusterService.update(created.id(), new UpdateClusterRequest("Updated", null));

        assertThat(updated.name()).isEqualTo("Updated");
        assertThat(updated.id()).isEqualTo(created.id());
        assertThat(updated.type()).isEqualTo("knowledge");
    }

    @Test
    void delete_removesCluster() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("To Delete", brainId, null, null, null));

        clusterService.delete(created.id());

        assertThat(clusterRepository.findById(created.id())).isEmpty();
    }

    @Test
    void archive_setsArchived() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("To Archive", brainId, null, null, null));

        ClusterResponse archived = clusterService.archive(created.id());

        assertThat(archived.isArchived()).isTrue();
    }

    @Test
    void restore_unsetsArchived() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("To Restore", brainId, null, null, null));
        clusterService.archive(created.id());

        ClusterResponse restored = clusterService.restore(created.id());

        assertThat(restored.isArchived()).isFalse();
    }

    @Test
    void restore_rejectsIfActiveUniqueTypeExists() {
        ClusterResponse first = clusterService.create(new CreateClusterRequest("Research 1", brainId, "ai-research", null, null));
        clusterService.archive(first.id());
        clusterService.create(new CreateClusterRequest("Research 2", brainId, "ai-research", null, null));

        assertThatThrownBy(() -> clusterService.restore(first.id()))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Only one ai-research cluster");
    }

    @Test
    void getById_returnsCluster() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("Test", brainId, null, null, null));

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
        ClusterResponse created = clusterService.create(new CreateClusterRequest("To Move", brainId, null, null, null));
        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");

        ClusterResponse moved = clusterService.move(created.id(), brain2.id());

        assertThat(moved.brainId()).isEqualTo(brain2.id());
    }

    @Test
    void move_throwsOnNonexistentBrain() {
        ClusterResponse created = clusterService.create(new CreateClusterRequest("Test", brainId, null, null, null));

        assertThatThrownBy(() -> clusterService.move(created.id(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void move_rejectsIfTargetBrainAlreadyHasUniqueType() {
        clusterService.create(new CreateClusterRequest("Research", brainId, "ai-research", null, null));

        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");
        ClusterResponse research2 = clusterService.create(new CreateClusterRequest("Research 2", brain2.id(), "ai-research", null, null));

        assertThatThrownBy(() -> clusterService.move(research2.id(), brainId))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Only one ai-research cluster");
    }

    @Test
    void reorder_updatesSortOrders() {
        ClusterResponse c1 = clusterService.create(new CreateClusterRequest("A", brainId, null, null, null));
        ClusterResponse c2 = clusterService.create(new CreateClusterRequest("B", brainId, null, null, null));
        ClusterResponse c3 = clusterService.create(new CreateClusterRequest("C", brainId, null, null, null));

        clusterService.reorder(new ReorderRequest(List.of(c3.id(), c1.id(), c2.id())));

        List<ClusterResponse> reordered = clusterService.getByBrainId(brainId);
        assertThat(reordered.get(0).name()).isEqualTo("C");
        assertThat(reordered.get(1).name()).isEqualTo("A");
        assertThat(reordered.get(2).name()).isEqualTo("B");
    }
}
