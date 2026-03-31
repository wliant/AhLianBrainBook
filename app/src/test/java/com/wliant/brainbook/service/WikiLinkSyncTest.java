package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronContentRequest;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.model.NeuronLink;
import com.wliant.brainbook.repository.NeuronLinkRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class WikiLinkSyncTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private NeuronLinkRepository neuronLinkRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID brainId;
    private UUID clusterId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        BrainResponse brain = testDataFactory.createBrain();
        brainId = brain.id();
        ClusterResponse cluster = testDataFactory.createCluster(brainId);
        clusterId = cluster.id();
    }

    @Test
    void extractWikiLinkIds_findsLinksInTiptapContent() {
        UUID targetId = UUID.randomUUID();
        String content = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + targetId + "\",\"neuronTitle\":\"Test\",\"href\":\"/test\"}}" +
                "]}";

        Set<UUID> ids = neuronService.extractWikiLinkIds(content);

        assertThat(ids).containsExactly(targetId);
    }

    @Test
    void extractWikiLinkIds_findsLinksInSectionsDocument() {
        UUID targetId = UUID.randomUUID();
        String content = "{\"version\":2,\"sections\":[{\"type\":\"rich-text\",\"content\":" +
                "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + targetId + "\"}}" +
                "]}}]}";

        Set<UUID> ids = neuronService.extractWikiLinkIds(content);

        assertThat(ids).containsExactly(targetId);
    }

    @Test
    void extractWikiLinkIds_returnsEmptyForNoLinks() {
        String content = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";

        Set<UUID> ids = neuronService.extractWikiLinkIds(content);

        assertThat(ids).isEmpty();
    }

    @Test
    void extractWikiLinkIds_handlesInvalidJson() {
        Set<UUID> ids = neuronService.extractWikiLinkIds("not json at all");

        assertThat(ids).isEmpty();
    }

    @Test
    void extractWikiLinkIds_skipsInvalidUuids() {
        String content = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"not-a-uuid\"}}" +
                "]}";

        Set<UUID> ids = neuronService.extractWikiLinkIds(content);

        assertThat(ids).isEmpty();
    }

    @Test
    void syncEditorLinks_createsLinksForNewReferences() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null));

        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";

        neuronService.syncEditorLinks(source.id(), contentWithLink);

        List<NeuronLink> links = neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor");
        assertThat(links).hasSize(1);
        assertThat(links.get(0).getTargetNeuronId()).isEqualTo(target.id());
        assertThat(links.get(0).getLinkType()).isEqualTo("references");
    }

    @Test
    void syncEditorLinks_removesStaleLinks() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null));

        // First sync: creates link
        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";
        neuronService.syncEditorLinks(source.id(), contentWithLink);
        assertThat(neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor")).hasSize(1);

        // Second sync: removes link (content no longer has the reference)
        String contentWithoutLink = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
        neuronService.syncEditorLinks(source.id(), contentWithoutLink);
        assertThat(neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor")).isEmpty();
    }

    @Test
    void syncEditorLinks_doesNotCreateSelfLinks() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));

        String contentWithSelfLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + source.id() + "\"}}" +
                "]}";

        neuronService.syncEditorLinks(source.id(), contentWithSelfLink);

        List<NeuronLink> links = neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor");
        assertThat(links).isEmpty();
    }

    @Test
    void syncEditorLinks_skipsNonExistentTargets() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));

        String contentWithBadTarget = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + UUID.randomUUID() + "\"}}" +
                "]}";

        neuronService.syncEditorLinks(source.id(), contentWithBadTarget);

        List<NeuronLink> links = neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor");
        assertThat(links).isEmpty();
    }

    @Test
    void syncEditorLinks_handlesNullContent() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));

        // Should not throw
        neuronService.syncEditorLinks(source.id(), null);
        neuronService.syncEditorLinks(source.id(), "");
    }

    @Test
    void updateContent_triggersLinkSync() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null));

        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";

        neuronService.updateContent(source.id(),
                new NeuronContentRequest(contentWithLink, "text", source.version()));

        List<NeuronLink> links = neuronLinkRepository.findBySourceNeuronIdAndSource(source.id(), "editor");
        assertThat(links).hasSize(1);
    }
}
