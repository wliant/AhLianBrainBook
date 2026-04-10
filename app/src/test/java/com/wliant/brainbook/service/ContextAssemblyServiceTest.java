package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.repository.NeuronEmbeddingRepository;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ContextAssemblyServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @MockitoSpyBean
    private IntelligenceService intelligenceService;

    @Autowired
    private ContextAssemblyService contextAssemblyService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronRepository neuronRepository;

    @Autowired
    private NeuronLinkRepository neuronLinkRepository;

    @Autowired
    private NeuronEmbeddingRepository neuronEmbeddingRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private BrainResponse brain;
    private ClusterResponse cluster;
    private NeuronResponse neuron1;
    private NeuronResponse neuron2;
    private NeuronResponse neuron3;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();

        // Prevent async embedding computation from leaking across tests.
        // The spy's real computeEmbedding makes HTTP calls to the intelligence service;
        // if that service happens to be running (e.g., from Docker), embeddings would be
        // stored and cause non-deterministic similarity search results.
        doReturn(null).when(intelligenceService).computeEmbedding(any());

        brain = testDataFactory.createBrain("Context Test Brain");
        cluster = testDataFactory.createCluster("Context Cluster", brain.id());
        neuron1 = testDataFactory.createNeuron("Main Neuron", brain.id(), cluster.id());
        neuron2 = testDataFactory.createNeuron("Related Neuron", brain.id(), cluster.id());
        neuron3 = testDataFactory.createNeuron("Sibling Neuron", brain.id(), cluster.id());

        // Add content to neurons so contentText is populated
        neuronService.updateContent(neuron1.id(),
                new NeuronContentRequest("{\"version\":2,\"sections\":[]}", "Main content about algorithms", neuron1.version()));
        neuronService.updateContent(neuron2.id(),
                new NeuronContentRequest("{\"version\":2,\"sections\":[]}", "Related content about sorting", neuron2.version()));
        neuronService.updateContent(neuron3.id(),
                new NeuronContentRequest("{\"version\":2,\"sections\":[]}", "Sibling content about data structures", neuron3.version()));
    }

    @Test
    void assembleKnowledgeContext_returnsClusterSiblings() {
        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), cluster.id(), "test message");

        // Should find cluster siblings (neuron2, neuron3)
        assertThat(context).isNotEmpty();
        List<String> titles = context.stream()
                .map(c -> (String) c.get("title"))
                .toList();
        assertThat(titles).contains("Related Neuron", "Sibling Neuron");
    }

    @Test
    void assembleKnowledgeContext_returnsLinkedNeurons() {
        // Create a link between neuron1 and neuron2
        var link = new NeuronLink();
        link.setSourceNeuron(neuronRepository.findById(neuron1.id()).orElseThrow());
        link.setTargetNeuron(neuronRepository.findById(neuron2.id()).orElseThrow());
        link.setLinkType("references");
        link.setWeight(1.0);
        link.setSource("manual");
        neuronLinkRepository.save(link);

        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), cluster.id(), "test");

        // neuron2 should appear with linked relationship and higher score than siblings
        var linkedEntry = context.stream()
                .filter(c -> "Related Neuron".equals(c.get("title")))
                .findFirst()
                .orElseThrow();
        assertThat((String) linkedEntry.get("relationship")).contains("linked");
        assertThat((double) linkedEntry.get("score")).isGreaterThan(0.3);
    }

    @Test
    void assembleKnowledgeContext_deduplicatesById() {
        // Create a link to neuron2 (which is also a cluster sibling)
        var link = new NeuronLink();
        link.setSourceNeuron(neuronRepository.findById(neuron1.id()).orElseThrow());
        link.setTargetNeuron(neuronRepository.findById(neuron2.id()).orElseThrow());
        link.setLinkType("related-to");
        link.setWeight(0.5);
        link.setSource("manual");
        neuronLinkRepository.save(link);

        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), cluster.id(), "test");

        // neuron2 should appear only once (deduped), with the higher score (linked > sibling)
        long neuron2Count = context.stream()
                .filter(c -> neuron2.id().toString().equals(c.get("neuron_id")))
                .count();
        assertThat(neuron2Count).isEqualTo(1);

        var entry = context.stream()
                .filter(c -> neuron2.id().toString().equals(c.get("neuron_id")))
                .findFirst()
                .orElseThrow();
        assertThat((double) entry.get("score")).isGreaterThan(0.3); // linked score > sibling 0.3
    }

    @Test
    void assembleKnowledgeContext_excludesCurrentNeuron() {
        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), cluster.id(), "test");

        List<String> ids = context.stream()
                .map(c -> (String) c.get("neuron_id"))
                .toList();
        assertThat(ids).doesNotContain(neuron1.id().toString());
    }

    @Test
    void assembleKnowledgeContext_handlesNullClusterId() {
        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), null, "test");

        // Should not throw, just returns fewer results (no cluster siblings)
        assertThat(context).isNotNull();
    }

    @Test
    void assembleKnowledgeContext_truncatesContentPreview() {
        // Create a neuron with very long content
        NeuronResponse longNeuron = testDataFactory.createNeuron("Long Neuron", brain.id(), cluster.id());
        String longText = "x".repeat(1000);
        neuronService.updateContent(longNeuron.id(),
                new NeuronContentRequest("{\"version\":2,\"sections\":[]}", longText, longNeuron.version()));

        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                neuron1.id(), brain.id(), cluster.id(), "test");

        var longEntry = context.stream()
                .filter(c -> "Long Neuron".equals(c.get("title")))
                .findFirst();
        if (longEntry.isPresent()) {
            String preview = (String) longEntry.get().get("content_preview");
            assertThat(preview.length()).isLessThanOrEqualTo(504); // 500 + "..."
        }
    }

    @Test
    void assembleKnowledgeContext_returnsEmptyWhenNoRelatedNeurons() {
        // Use a different cluster with only neuron1
        ClusterResponse isolatedCluster = testDataFactory.createCluster("Isolated", brain.id());
        NeuronResponse isolatedNeuron = testDataFactory.createNeuron("Alone", brain.id(), isolatedCluster.id());

        List<Map<String, Object>> context = contextAssemblyService.assembleKnowledgeContext(
                isolatedNeuron.id(), brain.id(), isolatedCluster.id(), "test");

        assertThat(context).isEmpty();
    }
}
