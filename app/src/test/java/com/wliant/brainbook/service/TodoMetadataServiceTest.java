package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TodoMetadataRequest;
import com.wliant.brainbook.dto.TodoMetadataResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TodoMetadataServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TodoMetadataService todoMetadataService;

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
    void getOrCreate_noExisting_createsDefault() {
        TodoMetadataResponse response = todoMetadataService.getOrCreate(chain.neuron().id());

        assertThat(response.neuronId()).isEqualTo(chain.neuron().id());
        assertThat(response.completed()).isFalse();
        assertThat(response.priority()).isEqualTo("normal");
        assertThat(response.dueDate()).isNull();
        assertThat(response.effort()).isNull();
        assertThat(response.completedAt()).isNull();
    }

    @Test
    void getOrCreate_existing_returnsExisting() {
        todoMetadataService.getOrCreate(chain.neuron().id());
        TodoMetadataResponse second = todoMetadataService.getOrCreate(chain.neuron().id());

        assertThat(second.neuronId()).isEqualTo(chain.neuron().id());
        assertThat(second.priority()).isEqualTo("normal");
    }

    @Test
    void update_setCompleted_setsCompletedAt() {
        todoMetadataService.getOrCreate(chain.neuron().id());

        TodoMetadataResponse response = todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(null, true, null, null));

        assertThat(response.completed()).isTrue();
        assertThat(response.completedAt()).isNotNull();
    }

    @Test
    void update_clearCompleted_clearsCompletedAt() {
        todoMetadataService.getOrCreate(chain.neuron().id());
        todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(null, true, null, null));

        TodoMetadataResponse response = todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(null, false, null, null));

        assertThat(response.completed()).isFalse();
        assertThat(response.completedAt()).isNull();
    }

    @Test
    void update_setPriority() {
        todoMetadataService.getOrCreate(chain.neuron().id());

        TodoMetadataResponse response = todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(null, null, null, "critical"));

        assertThat(response.priority()).isEqualTo("critical");
    }

    @Test
    void update_setEffort() {
        todoMetadataService.getOrCreate(chain.neuron().id());

        TodoMetadataResponse response = todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(null, null, "2hr", null));

        assertThat(response.effort()).isEqualTo("2hr");
    }

    @Test
    void update_setDueDate() {
        todoMetadataService.getOrCreate(chain.neuron().id());
        LocalDate dueDate = LocalDate.now().plusDays(7);

        TodoMetadataResponse response = todoMetadataService.update(chain.neuron().id(),
                new TodoMetadataRequest(dueDate, null, null, null));

        assertThat(response.dueDate()).isEqualTo(dueDate);
    }

    @Test
    void getByNeuronIds_returnsBatchMap() {
        NeuronResponse neuron2 = testDataFactory.createNeuron("Neuron 2",
                chain.brain().id(), chain.cluster().id());
        todoMetadataService.getOrCreate(chain.neuron().id());
        todoMetadataService.getOrCreate(neuron2.id());

        Map<UUID, TodoMetadataResponse> batch = todoMetadataService.getByNeuronIds(
                List.of(chain.neuron().id(), neuron2.id()));

        assertThat(batch).hasSize(2);
        assertThat(batch).containsKey(chain.neuron().id());
        assertThat(batch).containsKey(neuron2.id());
    }
}
