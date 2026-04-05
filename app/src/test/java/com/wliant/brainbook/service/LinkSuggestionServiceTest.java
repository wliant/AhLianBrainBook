package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.LinkSuggestionResponse;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.LinkSuggestion;
import com.wliant.brainbook.model.Neuron;
import com.wliant.brainbook.repository.LinkSuggestionRepository;
import com.wliant.brainbook.repository.NeuronRepository;
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
class LinkSuggestionServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private LinkSuggestionService linkSuggestionService;

    @Autowired
    private LinkSuggestionRepository linkSuggestionRepository;

    @Autowired
    private NeuronLinkService neuronLinkService;

    @Autowired
    private NeuronRepository neuronRepository;

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
    void getSuggestions_neuronNotFound_throws() {
        assertThatThrownBy(() -> linkSuggestionService.getSuggestionsForNeuron(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getSuggestions_emptyList_returnsEmpty() {
        List<LinkSuggestionResponse> suggestions = linkSuggestionService.getSuggestionsForNeuron(chain.neuron().id());

        assertThat(suggestions).isEmpty();
    }

    @Test
    void recomputeReferences_emptyContent_deletesAll() {
        NeuronResponse target = testDataFactory.createNeuron("Target", chain.brain().id(), chain.cluster().id());
        // Manually insert a reference suggestion using entity references
        Neuron sourceNeuron = neuronRepository.findById(chain.neuron().id()).orElseThrow();
        Neuron targetNeuron = neuronRepository.findById(target.id()).orElseThrow();
        LinkSuggestion suggestion = new LinkSuggestion();
        suggestion.setSourceNeuron(sourceNeuron);
        suggestion.setTargetNeuron(targetNeuron);
        suggestion.setSuggestionType("references");
        suggestion.setScore(1.0);
        linkSuggestionRepository.save(suggestion);

        // Recompute with empty content — should remove the suggestion
        linkSuggestionService.recomputeReferenceSuggestions(chain.neuron().id(), "{}");

        List<LinkSuggestion> remaining = linkSuggestionRepository.findBySourceNeuronIdAndSuggestionType(
                chain.neuron().id(), "references");
        assertThat(remaining).isEmpty();
    }

    @Test
    void recomputeReferences_selfLink_ignored() {
        // Content with a wiki-link pointing to self
        String content = "{\"version\":2,\"sections\":[{\"id\":\"s1\",\"type\":\"richtext\",\"order\":0,\"content\":{\"type\":\"doc\",\"content\":[{\"type\":\"wikiLink\",\"attrs\":{\"neuronId\":\"" + chain.neuron().id() + "\"}}]}}]}";

        linkSuggestionService.recomputeReferenceSuggestions(chain.neuron().id(), content);

        List<LinkSuggestion> suggestions = linkSuggestionRepository.findBySourceNeuronIdAndSuggestionType(
                chain.neuron().id(), "references");
        assertThat(suggestions).isEmpty();
    }

    @Test
    void acceptSuggestion_notFound_throws() {
        assertThatThrownBy(() -> linkSuggestionService.acceptSuggestion(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void acceptSuggestion_createsNeuronLink() {
        NeuronResponse target = testDataFactory.createNeuron("Target", chain.brain().id(), chain.cluster().id());
        Neuron sourceNeuron = neuronRepository.findById(chain.neuron().id()).orElseThrow();
        Neuron targetNeuron = neuronRepository.findById(target.id()).orElseThrow();
        LinkSuggestion suggestion = new LinkSuggestion();
        suggestion.setSourceNeuron(sourceNeuron);
        suggestion.setTargetNeuron(targetNeuron);
        suggestion.setSuggestionType("references");
        suggestion.setScore(1.0);
        suggestion = linkSuggestionRepository.save(suggestion);

        linkSuggestionService.acceptSuggestion(suggestion.getId());

        var links = neuronLinkService.getLinksForNeuron(chain.neuron().id());
        assertThat(links).anyMatch(l -> l.targetNeuronId().equals(target.id()));
    }
}
