package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import io.minio.MinioClient;
import org.springframework.jdbc.core.JdbcTemplate;
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
class ClusterServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private ClusterRepository clusterRepository;

    @Autowired
    private BrainRepository brainRepository;

    @Autowired
    private BrainService brainService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private UUID brainId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE brains CASCADE");
        BrainResponse brain = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000", null));
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
}
