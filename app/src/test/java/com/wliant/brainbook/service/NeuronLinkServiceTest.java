package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronLinkResponse;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.exception.ConflictException;
import com.wliant.brainbook.exception.ResourceNotFoundException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class NeuronLinkServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private NeuronLinkService neuronLinkService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID brainId;
    private UUID neuronId1;
    private UUID neuronId2;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        var chain = testDataFactory.createFullChain();
        brainId = chain.brain().id();
        neuronId1 = chain.neuron().id();
        NeuronResponse neuron2 = testDataFactory.createNeuron("Neuron 2", chain.brain().id(), chain.cluster().id());
        neuronId2 = neuron2.id();
    }

    @Test
    void create_savesLink() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "related", "association", 0.8);

        NeuronLinkResponse response = neuronLinkService.create(req);

        assertThat(response.id()).isNotNull();
        assertThat(response.sourceNeuronId()).isEqualTo(neuronId1);
        assertThat(response.targetNeuronId()).isEqualTo(neuronId2);
        assertThat(response.label()).isEqualTo("related");
        assertThat(response.linkType()).isEqualTo("association");
        assertThat(response.weight()).isEqualTo(0.8);
        assertThat(response.createdAt()).isNotNull();
    }

    @Test
    void create_withNullWeight_defaultsToOne() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null);

        NeuronLinkResponse response = neuronLinkService.create(req);

        assertThat(response.weight()).isEqualTo(1.0);
    }

    @Test
    void create_throwsOnSelfLink() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId1, "self", "ref", null);

        assertThatThrownBy(() -> neuronLinkService.create(req))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Cannot link a neuron to itself");
    }

    @Test
    void create_throwsOnDuplicateLink() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null);
        neuronLinkService.create(req);

        assertThatThrownBy(() -> neuronLinkService.create(req))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Link already exists");
    }

    @Test
    void create_throwsOnNonexistentSource() {
        NeuronLinkRequest req = new NeuronLinkRequest(UUID.randomUUID(), neuronId2, "link", "ref", null);

        assertThatThrownBy(() -> neuronLinkService.create(req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void create_throwsOnNonexistentTarget() {
        NeuronLinkRequest req = new NeuronLinkRequest(neuronId1, UUID.randomUUID(), "link", "ref", null);

        assertThatThrownBy(() -> neuronLinkService.create(req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getLinksForNeuron_returnsLinks() {
        neuronLinkService.create(new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null));

        List<NeuronLinkResponse> links = neuronLinkService.getLinksForNeuron(neuronId1);

        assertThat(links).hasSize(1);
        assertThat(links.get(0).sourceNeuronId()).isEqualTo(neuronId1);
    }

    @Test
    void getLinksForNeuron_throwsOnNonexistentNeuron() {
        assertThatThrownBy(() -> neuronLinkService.getLinksForNeuron(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getLinksForBrain_returnsLinks() {
        neuronLinkService.create(new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null));

        List<NeuronLinkResponse> links = neuronLinkService.getLinksForBrain(brainId);

        assertThat(links).hasSize(1);
    }

    @Test
    void delete_removesLink() {
        NeuronLinkResponse created = neuronLinkService.create(
                new NeuronLinkRequest(neuronId1, neuronId2, "link", "ref", null));

        neuronLinkService.delete(created.id());

        List<NeuronLinkResponse> links = neuronLinkService.getLinksForNeuron(neuronId1);
        assertThat(links).isEmpty();
    }

    @Test
    void delete_throwsOnNonexistentLink() {
        assertThatThrownBy(() -> neuronLinkService.delete(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
