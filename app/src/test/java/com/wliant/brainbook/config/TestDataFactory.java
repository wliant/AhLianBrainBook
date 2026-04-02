package com.wliant.brainbook.config;

import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.service.BrainService;
import com.wliant.brainbook.service.ClusterService;
import com.wliant.brainbook.service.NeuronService;
import com.wliant.brainbook.service.TagService;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class TestDataFactory {

    private final BrainService brainService;
    private final ClusterService clusterService;
    private final NeuronService neuronService;
    private final TagService tagService;

    public TestDataFactory(BrainService brainService, ClusterService clusterService,
                           NeuronService neuronService, TagService tagService) {
        this.brainService = brainService;
        this.clusterService = clusterService;
        this.neuronService = neuronService;
        this.tagService = tagService;
    }

    public BrainResponse createBrain() {
        return createBrain("Test Brain");
    }

    public BrainResponse createBrain(String name) {
        return brainService.create(new BrainRequest(name, "\uD83E\uDDE0", "#FF0000", null));
    }

    public ClusterResponse createCluster(UUID brainId) {
        return createCluster("Test Cluster", brainId);
    }

    public ClusterResponse createCluster(String name, UUID brainId) {
        return clusterService.create(new CreateClusterRequest(name, brainId, null));
    }

    public ClusterResponse createAiResearchCluster(UUID brainId) {
        return createAiResearchCluster("AI Research", brainId);
    }

    public ClusterResponse createAiResearchCluster(String name, UUID brainId) {
        return clusterService.create(new CreateClusterRequest(name, brainId, "ai-research"));
    }

    public NeuronResponse createNeuron(UUID brainId, UUID clusterId) {
        return createNeuron("Test Neuron", brainId, clusterId);
    }

    public NeuronResponse createNeuron(String title, UUID brainId, UUID clusterId) {
        return neuronService.create(new NeuronRequest(title, brainId, clusterId, null, null, null, null));
    }

    public TagResponse createTag(String name) {
        return tagService.create(new TagRequest(name, "#0000FF"));
    }

    public record BrainClusterNeuron(BrainResponse brain, ClusterResponse cluster, NeuronResponse neuron) {}

    public BrainClusterNeuron createFullChain() {
        BrainResponse brain = createBrain();
        ClusterResponse cluster = createCluster(brain.id());
        NeuronResponse neuron = createNeuron(brain.id(), cluster.id());
        return new BrainClusterNeuron(brain, cluster, neuron);
    }
}
