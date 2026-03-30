package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.SearchResponse;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class SearchServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private SearchService searchService;

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
    void search_returnsMatchingNeurons() {
        neuronService.create(new NeuronRequest("Spring Boot Guide", brainId, clusterId,
                null, "Learn about Spring Boot framework", null));

        SearchResponse response = searchService.search("Spring", null, null, null, null, 0, 20);

        assertThat(response.results()).isNotEmpty();
        assertThat(response.results().get(0).title()).isEqualTo("Spring Boot Guide");
    }

    @Test
    void search_returnsEmptyForBlankQuery() {
        neuronService.create(new NeuronRequest("Some Note", brainId, clusterId,
                null, "content", null));

        SearchResponse response = searchService.search("", null, null, null, null, 0, 20);

        assertThat(response.results()).isEmpty();
        assertThat(response.totalCount()).isEqualTo(0);
    }
}
