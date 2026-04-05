package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.CreateTaskFromNeuronRequest;
import com.wliant.brainbook.dto.CreateTaskFromNeuronResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TodoServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TodoService todoService;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private NeuronLinkService neuronLinkService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private BrainClusterNeuron chain;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        chain = testDataFactory.createFullChain();
    }

    @Test
    void createTaskFromNeuron_autoCreatesTodoCluster() {
        CreateTaskFromNeuronResponse response = todoService.createTaskFromNeuron(
                chain.brain().id(),
                new CreateTaskFromNeuronRequest(chain.neuron().id(), "New Task"));

        assertThat(response.neuron()).isNotNull();
        assertThat(response.neuron().title()).isEqualTo("New Task");
        assertThat(response.todoMetadata()).isNotNull();
        assertThat(response.todoMetadata().priority()).isEqualTo("normal");
        assertThat(response.clusterId()).isNotNull();
        assertThat(response.brainId()).isEqualTo(chain.brain().id());
    }

    @Test
    void createTaskFromNeuron_usesExistingTodoCluster() {
        testDataFactory.createTodoCluster(chain.brain().id());

        CreateTaskFromNeuronResponse response = todoService.createTaskFromNeuron(
                chain.brain().id(),
                new CreateTaskFromNeuronRequest(chain.neuron().id(), "Task in existing cluster"));

        assertThat(response.neuron().title()).isEqualTo("Task in existing cluster");
    }

    @Test
    void createTaskFromNeuron_createsNeuronLink() {
        CreateTaskFromNeuronResponse response = todoService.createTaskFromNeuron(
                chain.brain().id(),
                new CreateTaskFromNeuronRequest(chain.neuron().id(), "Linked Task"));

        var links = neuronLinkService.getLinksForNeuron(chain.neuron().id());
        assertThat(links).anyMatch(link ->
                link.targetNeuronId().equals(response.neuron().id())
                        && "task".equals(link.linkType()));
    }

    @Test
    void createTaskFromNeuron_sourceNotFound_throws() {
        UUID fakeId = UUID.randomUUID();

        assertThatThrownBy(() -> todoService.createTaskFromNeuron(
                chain.brain().id(),
                new CreateTaskFromNeuronRequest(fakeId, "Task")))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
