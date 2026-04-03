package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainStatsResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
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
class BrainStatsServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private BrainStatsService brainStatsService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronLinkService neuronLinkService;

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
        var brain = testDataFactory.createBrain();
        brainId = brain.id();
        var cluster = testDataFactory.createCluster(brainId);
        clusterId = cluster.id();
    }

    @Test
    void getStats_emptyBrain_returnsZeroCounts() {
        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.clusterCount()).isEqualTo(1); // setUp creates one cluster
        assertThat(stats.neuronCount()).isZero();
        assertThat(stats.tagCount()).isZero();
        assertThat(stats.linkCount()).isZero();
        assertThat(stats.simpleCount()).isZero();
        assertThat(stats.moderateCount()).isZero();
        assertThat(stats.complexCount()).isZero();
        assertThat(stats.mostConnected()).isEmpty();
        assertThat(stats.recentlyEdited()).isEmpty();
    }

    @Test
    void getStats_countsNeuronsAndClusters() {
        ClusterResponse cluster2 = testDataFactory.createCluster("Cluster 2", brainId);
        testDataFactory.createNeuron(brainId, clusterId);
        testDataFactory.createNeuron(brainId, clusterId);
        testDataFactory.createNeuron(brainId, cluster2.id());

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.clusterCount()).isEqualTo(2);
        assertThat(stats.neuronCount()).isEqualTo(3);
    }

    @Test
    void getStats_countsDistinctTags() {
        NeuronResponse neuron = testDataFactory.createNeuron(brainId, clusterId);
        var tag = testDataFactory.createTag("Java");
        tagService.addTagToNeuron(neuron.id(), tag.id());

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.tagCount()).isEqualTo(1);
    }

    @Test
    void getStats_countsLinks() {
        NeuronResponse n1 = testDataFactory.createNeuron("N1", brainId, clusterId);
        NeuronResponse n2 = testDataFactory.createNeuron("N2", brainId, clusterId);
        neuronLinkService.create(new NeuronLinkRequest(n1.id(), n2.id(), "link", "ref", null, null));

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.linkCount()).isEqualTo(1);
    }

    @Test
    void getStats_complexityDistribution() {
        NeuronResponse n1 = testDataFactory.createNeuron("Simple", brainId, clusterId);
        NeuronResponse n2 = testDataFactory.createNeuron("Moderate", brainId, clusterId);
        NeuronResponse n3 = testDataFactory.createNeuron("Complex", brainId, clusterId);

        neuronService.update(n1.id(), new NeuronRequest(null, null, null, null, null, null, "simple", null));
        neuronService.update(n2.id(), new NeuronRequest(null, null, null, null, null, null, "moderate", null));
        neuronService.update(n3.id(), new NeuronRequest(null, null, null, null, null, null, "complex", null));

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.simpleCount()).isEqualTo(1);
        assertThat(stats.moderateCount()).isEqualTo(1);
        assertThat(stats.complexCount()).isEqualTo(1);
    }

    @Test
    void getStats_mostConnectedNeurons() {
        NeuronResponse n1 = testDataFactory.createNeuron("Hub", brainId, clusterId);
        NeuronResponse n2 = testDataFactory.createNeuron("Leaf 1", brainId, clusterId);
        NeuronResponse n3 = testDataFactory.createNeuron("Leaf 2", brainId, clusterId);

        neuronLinkService.create(new NeuronLinkRequest(n1.id(), n2.id(), "link", "ref", null, null));
        neuronLinkService.create(new NeuronLinkRequest(n1.id(), n3.id(), "link", "ref", null, null));

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.mostConnected()).isNotEmpty();
        assertThat(stats.mostConnected().get(0).title()).isEqualTo("Hub");
        assertThat(stats.mostConnected().get(0).linkCount()).isEqualTo(2);
    }

    @Test
    void getStats_recentlyEditedNeurons() {
        testDataFactory.createNeuron("Recent", brainId, clusterId);

        BrainStatsResponse stats = brainStatsService.getStats(brainId);

        assertThat(stats.recentlyEdited()).hasSize(1);
        assertThat(stats.recentlyEdited().get(0).title()).isEqualTo("Recent");
    }
}
