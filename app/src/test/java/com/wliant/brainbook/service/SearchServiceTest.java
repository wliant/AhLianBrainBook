package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.SearchResponse;
import com.wliant.brainbook.dto.TagResponse;
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
class SearchServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private SearchService searchService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private TagService tagService;

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
    void search_returnsMatchingNeurons() {
        neuronService.create(new NeuronRequest("Spring Boot Guide", brainId, clusterId,
                null, "Learn about Spring Boot framework", null, null));

        SearchResponse response = searchService.search("Spring", null, null, null, null, 0, 20);

        assertThat(response.results()).isNotEmpty();
        assertThat(response.results().get(0).title()).isEqualTo("Spring Boot Guide");
    }

    @Test
    void search_returnsEmptyForBlankQuery() {
        neuronService.create(new NeuronRequest("Some Note", brainId, clusterId,
                null, "content", null, null));

        SearchResponse response = searchService.search("", null, null, null, null, 0, 20);

        assertThat(response.results()).isEmpty();
        assertThat(response.totalCount()).isEqualTo(0);
    }

    @Test
    void search_filtersByBrainId() {
        neuronService.create(new NeuronRequest("Unique Search Term ABC", brainId, clusterId,
                null, "Unique Search Term ABC", null, null));

        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");
        ClusterResponse cluster2 = testDataFactory.createCluster(brain2.id());
        neuronService.create(new NeuronRequest("Unique Search Term ABC", brain2.id(), cluster2.id(),
                null, "Unique Search Term ABC", null, null));

        SearchResponse response = searchService.search("Unique Search Term ABC", brainId, null, null, null, 0, 20);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).brainId()).isEqualTo(brainId);
    }

    @Test
    void search_filtersByClusterId() {
        neuronService.create(new NeuronRequest("Cluster Filter XYZ", brainId, clusterId,
                null, "Cluster Filter XYZ", null, null));

        ClusterResponse cluster2 = testDataFactory.createCluster("Cluster 2", brainId);
        neuronService.create(new NeuronRequest("Cluster Filter XYZ", brainId, cluster2.id(),
                null, "Cluster Filter XYZ", null, null));

        SearchResponse response = searchService.search("Cluster Filter XYZ", null, clusterId, null, null, 0, 20);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).clusterId()).isEqualTo(clusterId);
    }

    @Test
    void search_filtersByNeuronTags() {
        var neuron = neuronService.create(new NeuronRequest("Tagged Note QRS", brainId, clusterId,
                null, "Tagged Note QRS", null, null));
        TagResponse tag = testDataFactory.createTag("FilterTag");
        tagService.addTagToNeuron(neuron.id(), tag.id());

        neuronService.create(new NeuronRequest("Tagged Note QRS", brainId, clusterId,
                null, "Tagged Note QRS", null, null));

        SearchResponse response = searchService.search("Tagged Note QRS", null, null,
                List.of(tag.id()), null, 0, 20);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).id()).isEqualTo(neuron.id());
    }

    @Test
    void search_noMatchReturnsEmpty() {
        neuronService.create(new NeuronRequest("Real Note", brainId, clusterId,
                null, "content", null, null));

        SearchResponse response = searchService.search("zzzznonexistent12345", null, null, null, null, 0, 20);

        assertThat(response.results()).isEmpty();
    }
}
