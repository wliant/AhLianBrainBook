package com.wliant.brainbook.service;

import com.wliant.brainbook.dto.CreateClusterRequest;
import com.wliant.brainbook.dto.CreateTaskFromNeuronRequest;
import com.wliant.brainbook.dto.CreateTaskFromNeuronResponse;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TodoMetadataResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.Cluster;
import com.wliant.brainbook.model.ClusterType;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.model.TodoMetadata;
import com.wliant.brainbook.model.TodoPriority;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
import com.wliant.brainbook.repository.TodoMetadataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class TodoService {

    private static final Logger log = LoggerFactory.getLogger(TodoService.class);

    private final ClusterRepository clusterRepository;
    private final ClusterService clusterService;
    private final NeuronService neuronService;
    private final NeuronRepository neuronRepository;
    private final NeuronLinkService neuronLinkService;
    private final TodoMetadataRepository todoMetadataRepository;
    private final TodoMetadataService todoMetadataService;

    public TodoService(ClusterRepository clusterRepository,
                       ClusterService clusterService,
                       NeuronService neuronService,
                       NeuronRepository neuronRepository,
                       NeuronLinkService neuronLinkService,
                       TodoMetadataRepository todoMetadataRepository,
                       TodoMetadataService todoMetadataService) {
        this.clusterRepository = clusterRepository;
        this.clusterService = clusterService;
        this.neuronService = neuronService;
        this.neuronRepository = neuronRepository;
        this.neuronLinkService = neuronLinkService;
        this.todoMetadataRepository = todoMetadataRepository;
        this.todoMetadataService = todoMetadataService;
    }

    @Transactional
    public CreateTaskFromNeuronResponse createTaskFromNeuron(UUID brainId, CreateTaskFromNeuronRequest req) {
        // Validate source neuron exists
        Neuron source = neuronRepository.findById(req.sourceNeuronId())
                .orElseThrow(() -> new ResourceNotFoundException("Source neuron not found: " + req.sourceNeuronId()));

        // Find or create todo cluster
        Cluster todoCluster = clusterRepository.findFirstByBrainIdAndTypeAndIsArchivedFalse(brainId, ClusterType.TODO)
                .orElseGet(() -> {
                    log.info("Auto-creating todo cluster for brain {}", brainId);
                    var response = clusterService.create(new CreateClusterRequest("Tasks", brainId, "todo", null, null));
                    return clusterRepository.findById(response.id())
                            .orElseThrow(() -> new IllegalStateException("Failed to find newly created todo cluster"));
                });

        // Create neuron in todo cluster
        NeuronResponse neuronResponse = neuronService.create(new NeuronRequest(
                req.title(), brainId, todoCluster.getId(),
                null, null, null, null, null
        ));

        // Create todo metadata with defaults
        Neuron newNeuron = neuronRepository.findById(neuronResponse.id())
                .orElseThrow(() -> new IllegalStateException("Failed to find newly created neuron"));
        TodoMetadata meta = new TodoMetadata();
        meta.setNeuron(newNeuron);
        meta.setNeuronId(newNeuron.getId());
        meta.setPriority(TodoPriority.NORMAL);
        TodoMetadata savedMeta = todoMetadataRepository.save(meta);

        // Create link from source to task neuron
        neuronLinkService.create(new NeuronLinkRequest(
                req.sourceNeuronId(), newNeuron.getId(),
                "task", "task", null, "system"
        ));

        log.info("Created task '{}' in todo cluster {} from source neuron {}", req.title(), todoCluster.getId(), req.sourceNeuronId());

        return new CreateTaskFromNeuronResponse(
                neuronResponse,
                todoMetadataService.toResponse(savedMeta),
                todoCluster.getId(),
                brainId
        );
    }
}
