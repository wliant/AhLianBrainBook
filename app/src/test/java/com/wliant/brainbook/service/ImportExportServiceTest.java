package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainExportDto;
import com.wliant.brainbook.dto.BrainImportDto;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.NeuronLinkRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagResponse;
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
class ImportExportServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ImportExportService importExportService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronLinkService neuronLinkService;

    @Autowired
    private TagService tagService;

    @Autowired
    private BrainService brainService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @Test
    void exportBrain_returnsAllData() {
        var chain = testDataFactory.createFullChain();
        UUID brainId = chain.brain().id();
        UUID neuronId = chain.neuron().id();

        // Add a tag
        TagResponse tag = testDataFactory.createTag("Java");
        tagService.addTagToNeuron(neuronId, tag.id());

        // Add a second neuron and link
        NeuronResponse neuron2 = testDataFactory.createNeuron("Neuron 2", brainId, chain.cluster().id());
        neuronLinkService.create(new NeuronLinkRequest(neuronId, neuron2.id(), "related", "ref", 1.0));

        BrainExportDto export = importExportService.exportBrain(brainId);

        assertThat(export.version()).isEqualTo("1.0");
        assertThat(export.brain().name()).isEqualTo("Test Brain");
        assertThat(export.clusters()).hasSize(1);
        assertThat(export.neurons()).hasSize(2);
        assertThat(export.tags()).hasSize(1);
        assertThat(export.tags().get(0).name()).isEqualTo("Java");
        assertThat(export.links()).hasSize(1);
    }

    @Test
    void exportBrain_throwsOnNonexistentBrain() {
        assertThatThrownBy(() -> importExportService.exportBrain(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void importBrain_createsFullBrain() {
        BrainImportDto dto = new BrainImportDto(
                "Imported Brain",
                "A description",
                List.of(new BrainImportDto.ImportCluster(
                        "c1", "Cluster 1", null, 0,
                        List.of(new BrainImportDto.ImportNeuron(
                                "n1", "Note 1", "{}", "text", 0, List.of("Java")))
                )),
                List.of(new BrainImportDto.ImportTag("Java", "#0000FF")),
                null
        );

        BrainResponse result = importExportService.importBrain(dto);

        assertThat(result.id()).isNotNull();
        assertThat(result.name()).isEqualTo("Imported Brain");

        // Verify the brain has data
        List<BrainResponse> brains = brainService.getAll();
        assertThat(brains).hasSize(1);
    }

    @Test
    void importBrain_deduplicatesTags() {
        BrainImportDto dto = new BrainImportDto(
                "Brain",
                null,
                List.of(new BrainImportDto.ImportCluster(
                        "c1", "Cluster", null, 0,
                        List.of(
                                new BrainImportDto.ImportNeuron("n1", "Note 1", null, null, 0, List.of("Java")),
                                new BrainImportDto.ImportNeuron("n2", "Note 2", null, null, 1, List.of("Java"))
                        )
                )),
                List.of(new BrainImportDto.ImportTag("Java", "#0000FF")),
                null
        );

        importExportService.importBrain(dto);

        List<TagResponse> allTags = tagService.getAll();
        long javaCount = allTags.stream().filter(t -> t.name().equalsIgnoreCase("Java")).count();
        assertThat(javaCount).isEqualTo(1);
    }

    @Test
    void importBrain_setsClusterParents() {
        BrainImportDto dto = new BrainImportDto(
                "Brain",
                null,
                List.of(
                        new BrainImportDto.ImportCluster("c1", "Parent", null, 0, null),
                        new BrainImportDto.ImportCluster("c2", "Child", "c1", 1, null)
                ),
                null,
                null
        );

        BrainResponse result = importExportService.importBrain(dto);

        var clusters = new java.util.ArrayList<>(
                importExportService.exportBrain(result.id()).clusters());
        var child = clusters.stream().filter(c -> c.name().equals("Child")).findFirst().orElseThrow();
        assertThat(child.parentClusterId()).isNotNull();
    }

    @Test
    void importBrain_skipsLinkForSameSourceAndTarget() {
        BrainImportDto dto = new BrainImportDto(
                "Brain",
                null,
                List.of(new BrainImportDto.ImportCluster(
                        "c1", "Cluster", null, 0,
                        List.of(new BrainImportDto.ImportNeuron("n1", "Note", null, null, 0, null))
                )),
                null,
                List.of(new BrainImportDto.ImportLink("n1", "n1", "self", "ref", null))
        );

        BrainResponse result = importExportService.importBrain(dto);

        BrainExportDto export = importExportService.exportBrain(result.id());
        assertThat(export.links()).isEmpty();
    }

    @Test
    void roundTrip_exportThenImport() {
        // Create a brain with data
        var chain = testDataFactory.createFullChain();
        UUID brainId = chain.brain().id();
        NeuronResponse neuron2 = testDataFactory.createNeuron("Neuron 2", brainId, chain.cluster().id());
        TagResponse tag = testDataFactory.createTag("Spring");
        tagService.addTagToNeuron(chain.neuron().id(), tag.id());
        neuronLinkService.create(new NeuronLinkRequest(
                chain.neuron().id(), neuron2.id(), "link", "ref", null));

        // Export
        BrainExportDto export = importExportService.exportBrain(brainId);

        // Build import DTO from export
        var importClusters = export.clusters().stream()
                .map(c -> new BrainImportDto.ImportCluster(
                        c.id().toString(), c.name(), null, c.sortOrder(),
                        export.neurons().stream()
                                .filter(n -> c.id().equals(n.clusterId()))
                                .map(n -> new BrainImportDto.ImportNeuron(
                                        n.id().toString(), n.title(), n.contentJson(), n.contentText(),
                                        n.sortOrder(), n.tagNames()))
                                .toList()
                ))
                .toList();

        var importTags = export.tags().stream()
                .map(t -> new BrainImportDto.ImportTag(t.name(), t.color()))
                .toList();

        var importLinks = export.links().stream()
                .map(l -> new BrainImportDto.ImportLink(
                        l.sourceNeuronId().toString(), l.targetNeuronId().toString(),
                        l.label(), l.linkType(), l.weight()))
                .toList();

        BrainImportDto importDto = new BrainImportDto(
                export.brain().name() + " (copy)", null,
                importClusters, importTags, importLinks);

        // Import
        BrainResponse imported = importExportService.importBrain(importDto);

        // Verify structure matches
        BrainExportDto reimport = importExportService.exportBrain(imported.id());
        assertThat(reimport.clusters()).hasSameSizeAs(export.clusters());
        assertThat(reimport.neurons()).hasSameSizeAs(export.neurons());
        assertThat(reimport.links()).hasSameSizeAs(export.links());
    }
}
