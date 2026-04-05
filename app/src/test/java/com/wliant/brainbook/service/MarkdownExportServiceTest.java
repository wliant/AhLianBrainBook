package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.NeuronResponse;
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
class MarkdownExportServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private MarkdownExportService markdownExportService;

    @Autowired
    private NeuronService neuronService;

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
    void exportNeuronAsMarkdown_returnsMarkdown() {
        String markdown = markdownExportService.exportNeuronAsMarkdown(chain.neuron().id());

        assertThat(markdown).isNotNull();
        assertThat(markdown).contains("# " + chain.neuron().title());
    }

    @Test
    void exportNeuronAsMarkdown_notFound_throws() {
        assertThatThrownBy(() -> markdownExportService.exportNeuronAsMarkdown(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void exportNeuronAsMarkdown_withContent_includesContent() {
        NeuronResponse neuronWithContent = testDataFactory.createNeuronWithContent(
                chain.brain().id(), chain.cluster().id());

        String markdown = markdownExportService.exportNeuronAsMarkdown(neuronWithContent.id());

        assertThat(markdown).contains("Hello world");
    }

    @Test
    void exportBrainAsMarkdownZip_returnsZipBytes() {
        byte[] zip = markdownExportService.exportBrainAsMarkdownZip(chain.brain().id());

        assertThat(zip).isNotNull();
        assertThat(zip.length).isGreaterThan(0);
        // Zip files start with PK magic bytes
        assertThat(zip[0]).isEqualTo((byte) 0x50);
        assertThat(zip[1]).isEqualTo((byte) 0x4B);
    }

    @Test
    void exportBrainAsMarkdownZip_notFound_throws() {
        assertThatThrownBy(() -> markdownExportService.exportBrainAsMarkdownZip(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
