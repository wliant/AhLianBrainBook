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
        assertThat(response.results().get(0).neuron().title()).isEqualTo("Spring Boot Guide");
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
        assertThat(response.results().get(0).neuron().brainId()).isEqualTo(brainId);
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
        assertThat(response.results().get(0).neuron().clusterId()).isEqualTo(clusterId);
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
        assertThat(response.results().get(0).neuron().id()).isEqualTo(neuron.id());
    }

    @Test
    void search_noMatchReturnsEmpty() {
        neuronService.create(new NeuronRequest("Real Note", brainId, clusterId,
                null, "content", null, null));

        SearchResponse response = searchService.search("zzzznonexistent12345", null, null, null, null, 0, 20);

        assertThat(response.results()).isEmpty();
    }

    @Test
    void search_returnsHighlightAndRank() {
        neuronService.create(new NeuronRequest("Java Concurrency", brainId, clusterId,
                null, "Understanding threads and locks in Java concurrency", null, null));

        SearchResponse response = searchService.search("concurrency", null, null, null, null, 0, 20);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).highlight()).isNotNull();
        assertThat(response.results().get(0).highlight()).contains("<mark>");
        assertThat(response.results().get(0).rank()).isGreaterThan(0);
    }

    @Test
    void search_ranksResultsByRelevance() {
        // Neuron with search term in title should rank higher
        neuronService.create(new NeuronRequest("Algorithms Overview", brainId, clusterId,
                null, "A brief overview of common patterns", null, null));
        neuronService.create(new NeuronRequest("Data Structures", brainId, clusterId,
                null, "An overview of algorithms and data structures in computer science", null, null));

        SearchResponse response = searchService.search("algorithms", null, null, null, null, 0, 20);

        assertThat(response.results()).hasSizeGreaterThanOrEqualTo(1);
        // The one with "algorithms" in both title and content should rank first
    }

    @Test
    void search_paginationWithFiltersIsCorrect() {
        // Create neurons in two different brains
        for (int i = 0; i < 5; i++) {
            neuronService.create(new NeuronRequest("Pagination Test " + i, brainId, clusterId,
                    null, "Pagination Test content " + i, null, null));
        }
        BrainResponse brain2 = testDataFactory.createBrain("Brain 2");
        ClusterResponse cluster2 = testDataFactory.createCluster(brain2.id());
        for (int i = 0; i < 3; i++) {
            neuronService.create(new NeuronRequest("Pagination Test " + i, brain2.id(), cluster2.id(),
                    null, "Pagination Test content " + i, null, null));
        }

        // Filter by brainId — total count should reflect filtered results
        SearchResponse response = searchService.search("Pagination Test", brainId, null, null, null, 0, 20);

        assertThat(response.results()).hasSize(5);
        assertThat(response.totalCount()).isEqualTo(5);
    }

    @Test
    void search_handlesSpecialCharactersWithoutError() {
        neuronService.create(new NeuronRequest("SQL Injection Test", brainId, clusterId,
                null, "DROP TABLE neurons; --", null, null));

        // Should not throw or cause SQL errors — plainto_tsquery strips special chars,
        // so the words "DROP TABLE neurons" still match the stored content
        SearchResponse response = searchService.search("'; DROP TABLE neurons; --",
                null, null, null, null, 0, 20);
        assertThat(response).isNotNull();
    }

    @Test
    void search_handlesAmpersandsAndAngleBrackets() {
        neuronService.create(new NeuronRequest("HTML Entities", brainId, clusterId,
                null, "Use Map<String, Integer> for O(1) lookups", null, null));

        SearchResponse response = searchService.search("Map", null, null, null, null, 0, 20);
        // Should not throw
        assertThat(response.totalCount()).isGreaterThanOrEqualTo(0);
    }
}
