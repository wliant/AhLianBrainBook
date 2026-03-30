package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.repository.TagRepository;
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

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TagServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TagService tagService;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
    }

    @Test
    void create_savesTag() {
        TagResponse response = tagService.create(new TagRequest("Java", "#0000FF"));

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("Java");
        assertThat(response.color()).isEqualTo("#0000FF");
    }

    @Test
    void getAll_returnsTags() {
        tagService.create(new TagRequest("Java", "#0000FF"));
        tagService.create(new TagRequest("Spring", "#00FF00"));

        List<TagResponse> tags = tagService.getAll();

        assertThat(tags).hasSize(2);
    }

    @Test
    void delete_removesTag() {
        TagResponse created = tagService.create(new TagRequest("Java", "#0000FF"));

        tagService.delete(created.id());

        assertThat(tagRepository.findById(created.id())).isEmpty();
    }

    @Test
    void addTagToNeuron_linksTag() {
        TagResponse tag = tagService.create(new TagRequest("Java", "#0000FF"));
        NeuronResponse neuron = createTestNeuron();

        tagService.addTagToNeuron(neuron.id(), tag.id());

        List<TagResponse> tags = tagService.getTagsForNeuron(neuron.id());
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).name()).isEqualTo("Java");
    }

    @Test
    void removeTagFromNeuron_unlinksTag() {
        TagResponse tag = tagService.create(new TagRequest("Java", "#0000FF"));
        NeuronResponse neuron = createTestNeuron();
        tagService.addTagToNeuron(neuron.id(), tag.id());

        tagService.removeTagFromNeuron(neuron.id(), tag.id());

        List<TagResponse> tags = tagService.getTagsForNeuron(neuron.id());
        assertThat(tags).isEmpty();
    }

    private NeuronResponse createTestNeuron() {
        return testDataFactory.createFullChain().neuron();
    }

    @Test
    void search_returnsMatchingTags() {
        tagService.create(new TagRequest("JavaScript", "#FFFF00"));
        tagService.create(new TagRequest("Java", "#0000FF"));
        tagService.create(new TagRequest("Python", "#00FF00"));

        List<TagResponse> results = tagService.search("Java");

        assertThat(results).hasSize(2);
    }

    @Test
    void addTagToBrain_linksBrainAndTag() {
        var brain = testDataFactory.createBrain();
        TagResponse tag = tagService.create(new TagRequest("DevOps", "#FF0000"));

        tagService.addTagToBrain(brain.id(), tag.id());

        List<TagResponse> tags = tagService.getTagsForBrain(brain.id());
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).name()).isEqualTo("DevOps");
    }

    @Test
    void removeTagFromBrain_unlinksBrainAndTag() {
        var brain = testDataFactory.createBrain();
        TagResponse tag = tagService.create(new TagRequest("DevOps", "#FF0000"));
        tagService.addTagToBrain(brain.id(), tag.id());

        tagService.removeTagFromBrain(brain.id(), tag.id());

        List<TagResponse> tags = tagService.getTagsForBrain(brain.id());
        assertThat(tags).isEmpty();
    }

    @Test
    void getTagsForBrain_returnsEmptyWhenNoTags() {
        var brain = testDataFactory.createBrain();

        List<TagResponse> tags = tagService.getTagsForBrain(brain.id());

        assertThat(tags).isEmpty();
    }

    @Test
    void addTagToNeuron_idempotent() {
        TagResponse tag = tagService.create(new TagRequest("Java", "#0000FF"));
        NeuronResponse neuron = createTestNeuron();

        tagService.addTagToNeuron(neuron.id(), tag.id());
        tagService.addTagToNeuron(neuron.id(), tag.id()); // second call should not fail

        List<TagResponse> tags = tagService.getTagsForNeuron(neuron.id());
        assertThat(tags).hasSize(1);
    }
}
