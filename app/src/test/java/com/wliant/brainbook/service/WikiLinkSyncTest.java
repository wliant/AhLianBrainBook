package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.LinkSuggestionResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.repository.LinkSuggestionRepository;
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
    private LinkSuggestionService linkSuggestionService;

    @Autowired
    private LinkSuggestionRepository linkSuggestionRepository;

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

        Set<UUID> ids = WikiLinkExtractor.extractWikiLinkIds(content);

        assertThat(ids).containsExactly(targetId);
    }

    @Test
    void extractWikiLinkIds_findsLinksInSectionsDocument() {
        UUID targetId = UUID.randomUUID();
        String content = "{\"version\":2,\"sections\":[{\"type\":\"rich-text\",\"content\":" +
                "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + targetId + "\"}}" +
                "]}}]}";

        Set<UUID> ids = WikiLinkExtractor.extractWikiLinkIds(content);

        assertThat(ids).containsExactly(targetId);
    }

    @Test
    void extractWikiLinkIds_returnsEmptyForNoLinks() {
        String content = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";

        Set<UUID> ids = WikiLinkExtractor.extractWikiLinkIds(content);

        assertThat(ids).isEmpty();
    }

    @Test
    void extractWikiLinkIds_handlesInvalidJson() {
        Set<UUID> ids = WikiLinkExtractor.extractWikiLinkIds("not json at all");

        assertThat(ids).isEmpty();
    }

    @Test
    void extractWikiLinkIds_skipsInvalidUuids() {
        String content = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"not-a-uuid\"}}" +
                "]}";

        Set<UUID> ids = WikiLinkExtractor.extractWikiLinkIds(content);

        assertThat(ids).isEmpty();
    }

    @Test
    void recomputeReferenceSuggestions_createsSuggestionsForWikiLinks() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null, null));

        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";

        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithLink);

        List<LinkSuggestionResponse> suggestions = linkSuggestionService.getSuggestionsForNeuron(source.id());
        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).displayType()).isEqualTo("references");
        assertThat(suggestions.get(0).targetNeuronId()).isEqualTo(target.id());
    }

    @Test
    void recomputeReferenceSuggestions_removesStaleOnRecompute() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null, null));

        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";
        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithLink);
        assertThat(linkSuggestionService.getSuggestionsForNeuron(source.id())).hasSize(1);

        String contentWithoutLink = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithoutLink);
        assertThat(linkSuggestionService.getSuggestionsForNeuron(source.id())).isEmpty();
    }

    @Test
    void recomputeReferenceSuggestions_doesNotCreateSelfSuggestions() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));

        String contentWithSelfLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + source.id() + "\"}}" +
                "]}";

        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithSelfLink);

        assertThat(linkSuggestionService.getSuggestionsForNeuron(source.id())).isEmpty();
    }

    @Test
    void recomputeReferenceSuggestions_skipsNonExistentTargets() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));

        String contentWithBadTarget = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + UUID.randomUUID() + "\"}}" +
                "]}";

        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithBadTarget);

        assertThat(linkSuggestionService.getSuggestionsForNeuron(source.id())).isEmpty();
    }

    @Test
    void recomputeReferenceSuggestions_handlesNullContent() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));

        linkSuggestionService.recomputeReferenceSuggestions(source.id(), null);
        linkSuggestionService.recomputeReferenceSuggestions(source.id(), "");
        // Should not throw
    }

    @Test
    void referencedBy_appearsOnTargetNeuron() {
        NeuronResponse source = neuronService.create(
                new NeuronRequest("Source", brainId, clusterId, null, "content", null, null, null));
        NeuronResponse target = neuronService.create(
                new NeuronRequest("Target", brainId, clusterId, null, "content", null, null, null));

        String contentWithLink = "{\"type\":\"doc\",\"content\":[" +
                "{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + target.id() + "\"}}" +
                "]}";

        linkSuggestionService.recomputeReferenceSuggestions(source.id(), contentWithLink);

        // Target neuron should see a "referenced_by" suggestion
        List<LinkSuggestionResponse> targetSuggestions = linkSuggestionService.getSuggestionsForNeuron(target.id());
        assertThat(targetSuggestions).hasSize(1);
        assertThat(targetSuggestions.get(0).displayType()).isEqualTo("referenced_by");
        assertThat(targetSuggestions.get(0).sourceNeuronId()).isEqualTo(source.id());
    }
}
