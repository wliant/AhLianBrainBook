package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.*;
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
class ThoughtServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ThoughtService thoughtService;

    @Autowired
    private TagService tagService;

    @Autowired
    private BrainService brainService;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private NeuronService neuronService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    private UUID createTag(String name) {
        return tagService.create(new TagRequest(name, null)).id();
    }

    private UUID createNeuronInNewBrain(String title) {
        var brain = brainService.create(new BrainRequest("Brain-" + title, null, null, null));
        var cluster = clusterService.create(new CreateClusterRequest("Cluster-" + title, brain.id(), null, null, null));
        return neuronService.create(new NeuronRequest(title, brain.id(), cluster.id(),
                null, null, null, null, null)).id();
    }

    @Test
    void getAll_returnsEmpty() {
        List<ThoughtResponse> result = thoughtService.getAll();
        assertThat(result).isEmpty();
    }

    @Test
    void create_savesAndReturnsThought() {
        UUID tagId = createTag("test-tag");
        ThoughtRequest request = new ThoughtRequest("My Thought", "A description", "any", "any",
                List.of(tagId), null);

        ThoughtResponse response = thoughtService.create(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("My Thought");
        assertThat(response.description()).isEqualTo("A description");
        assertThat(response.neuronTagMode()).isEqualTo("any");
        assertThat(response.brainTagMode()).isEqualTo("any");
    }

    @Test
    void create_defaultsModesToAny() {
        UUID tagId = createTag("default-mode-tag");
        ThoughtRequest request = new ThoughtRequest("Defaults", null, null, null,
                List.of(tagId), null);

        ThoughtResponse response = thoughtService.create(request);

        assertThat(response.neuronTagMode()).isEqualTo("any");
        assertThat(response.brainTagMode()).isEqualTo("any");
    }

    @Test
    void create_storesNeuronTags() {
        UUID tag1 = createTag("tag-a");
        UUID tag2 = createTag("tag-b");
        ThoughtRequest request = new ThoughtRequest("Tagged Thought", null, "any", "any",
                List.of(tag1, tag2), null);

        ThoughtResponse response = thoughtService.create(request);
        ThoughtResponse fetched = thoughtService.getById(response.id());

        assertThat(fetched.neuronTags()).hasSize(2);
        assertThat(fetched.neuronTags().stream().map(TagResponse::id))
                .containsExactlyInAnyOrder(tag1, tag2);
    }

    @Test
    void getById_returnsThought() {
        UUID tagId = createTag("get-tag");
        ThoughtResponse created = thoughtService.create(
                new ThoughtRequest("Get Me", null, "any", "any", List.of(tagId), null));

        ThoughtResponse response = thoughtService.getById(created.id());

        assertThat(response.name()).isEqualTo("Get Me");
        assertThat(response.neuronTags()).hasSize(1);
    }

    @Test
    void getById_throwsWhenNotFound() {
        UUID randomId = UUID.randomUUID();
        assertThatThrownBy(() -> thoughtService.getById(randomId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void update_changesFields() {
        UUID tag1 = createTag("update-a");
        UUID tag2 = createTag("update-b");
        ThoughtResponse created = thoughtService.create(
                new ThoughtRequest("Before", null, "any", "any", List.of(tag1), null));

        ThoughtResponse updated = thoughtService.update(created.id(),
                new ThoughtRequest("After", "New desc", "all", "any",
                        List.of(tag1, tag2), null));

        assertThat(updated.name()).isEqualTo("After");
        assertThat(updated.description()).isEqualTo("New desc");
        assertThat(updated.neuronTagMode()).isEqualTo("all");
    }

    @Test
    void delete_removesThought() {
        UUID tagId = createTag("del-tag");
        ThoughtResponse created = thoughtService.create(
                new ThoughtRequest("Delete Me", null, "any", "any", List.of(tagId), null));

        thoughtService.delete(created.id());

        assertThat(thoughtService.getAll()).isEmpty();
    }

    @Test
    void delete_throwsWhenNotFound() {
        assertThatThrownBy(() -> thoughtService.delete(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void resolveNeurons_anyMode_returnsNeuronsWithAnyTag() {
        UUID tagX = createTag("resolve-any-x");
        UUID tagY = createTag("resolve-any-y");

        UUID neuronA = createNeuronInNewBrain("A");
        UUID neuronB = createNeuronInNewBrain("B");
        UUID neuronC = createNeuronInNewBrain("C");

        tagService.addTagToNeuron(neuronA, tagX);
        tagService.addTagToNeuron(neuronB, tagY);
        tagService.addTagToNeuron(neuronC, tagX);
        tagService.addTagToNeuron(neuronC, tagY);

        ThoughtResponse thought = thoughtService.create(
                new ThoughtRequest("Any", null, "any", "any", List.of(tagX, tagY), null));

        List<NeuronResponse> neurons = thoughtService.resolveNeurons(thought.id());
        List<UUID> ids = neurons.stream().map(NeuronResponse::id).toList();

        assertThat(ids).containsExactlyInAnyOrder(neuronA, neuronB, neuronC);
    }

    @Test
    void resolveNeurons_allMode_returnsOnlyNeuronsWithAllTags() {
        UUID tagX = createTag("resolve-all-x");
        UUID tagY = createTag("resolve-all-y");

        UUID neuronA = createNeuronInNewBrain("A");
        UUID neuronB = createNeuronInNewBrain("B");
        UUID neuronC = createNeuronInNewBrain("C");

        tagService.addTagToNeuron(neuronA, tagX);
        tagService.addTagToNeuron(neuronB, tagY);
        tagService.addTagToNeuron(neuronC, tagX);
        tagService.addTagToNeuron(neuronC, tagY);

        ThoughtResponse thought = thoughtService.create(
                new ThoughtRequest("All", null, "all", "any", List.of(tagX, tagY), null));

        List<NeuronResponse> neurons = thoughtService.resolveNeurons(thought.id());
        List<UUID> ids = neurons.stream().map(NeuronResponse::id).toList();

        assertThat(ids).containsExactly(neuronC);
        assertThat(ids).doesNotContain(neuronA, neuronB);
    }

    @Test
    void resolveNeurons_emptyWhenNoMatch() {
        UUID tagId = createTag("no-match-tag");
        ThoughtResponse thought = thoughtService.create(
                new ThoughtRequest("Empty", null, "any", "any", List.of(tagId), null));

        List<NeuronResponse> neurons = thoughtService.resolveNeurons(thought.id());

        assertThat(neurons).isEmpty();
    }
}
