package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.CreateNeuronAnchorRequest;
import com.wliant.brainbook.dto.NeuronAnchorResponse;
import com.wliant.brainbook.dto.UpdateNeuronAnchorRequest;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class AnchorServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private AnchorService anchorService;

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
    void create_savesAndReturns() {
        NeuronAnchorResponse response = anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        assertThat(response.id()).isNotNull();
        assertThat(response.neuronId()).isEqualTo(chain.neuron().id());
        assertThat(response.clusterId()).isEqualTo(chain.cluster().id());
        assertThat(response.filePath()).isEqualTo("src/Main.java");
    }

    @Test
    void create_neuronNotFound_throws() {
        assertThatThrownBy(() -> anchorService.create(
                new CreateNeuronAnchorRequest(UUID.randomUUID(), chain.cluster().id(), "src/Main.java")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void create_clusterNotFound_throws() {
        assertThatThrownBy(() -> anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), UUID.randomUUID(), "src/Main.java")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void create_duplicateNeuron_throwsConflict() {
        anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        assertThatThrownBy(() -> anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Other.java")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void update_updatesFilePath() {
        NeuronAnchorResponse created = anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        NeuronAnchorResponse updated = anchorService.update(created.id(),
                new UpdateNeuronAnchorRequest("src/NewMain.java"));

        assertThat(updated.filePath()).isEqualTo("src/NewMain.java");
    }

    @Test
    void update_notFound_throws() {
        assertThatThrownBy(() -> anchorService.update(UUID.randomUUID(),
                new UpdateNeuronAnchorRequest("src/Main.java")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_removesAnchor() {
        NeuronAnchorResponse created = anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        anchorService.delete(created.id());

        assertThat(anchorService.getByNeuronId(chain.neuron().id())).isNull();
    }

    @Test
    void delete_notFound_throws() {
        assertThatThrownBy(() -> anchorService.delete(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getByNeuronId_returnsNullWhenMissing() {
        NeuronAnchorResponse result = anchorService.getByNeuronId(chain.neuron().id());

        assertThat(result).isNull();
    }

    @Test
    void listByCluster_returnsPaginated() {
        anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        Page<NeuronAnchorResponse> page = anchorService.listByCluster(
                chain.cluster().id(), PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().getFirst().filePath()).isEqualTo("src/Main.java");
    }

    @Test
    void listByFile_returnsPaginated() {
        anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Main.java"));

        Page<NeuronAnchorResponse> page = anchorService.listByFile(
                chain.cluster().id(), "src/Main.java", PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test
    void updateFilePathsForRenames_updatesMatching() {
        anchorService.create(
                new CreateNeuronAnchorRequest(chain.neuron().id(), chain.cluster().id(), "src/Old.java"));

        int count = anchorService.updateFilePathsForRenames(
                chain.cluster().id(), Map.of("src/Old.java", "src/New.java"));

        assertThat(count).isEqualTo(1);
        NeuronAnchorResponse anchor = anchorService.getByNeuronId(chain.neuron().id());
        assertThat(anchor.filePath()).isEqualTo("src/New.java");
    }

    @Test
    void updateFilePathsForRenames_emptyMap_returnsZero() {
        int count = anchorService.updateFilePathsForRenames(chain.cluster().id(), Map.of());

        assertThat(count).isEqualTo(0);
    }
}
