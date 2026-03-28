package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.dto.ClusterRequest;
import com.wliant.brainbook.dto.ClusterResponse;
import com.wliant.brainbook.dto.NeuronRequest;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.TagRequest;
import com.wliant.brainbook.dto.TagResponse;
import com.wliant.brainbook.repository.BrainRepository;
import com.wliant.brainbook.repository.ClusterRepository;
import com.wliant.brainbook.repository.NeuronRepository;
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
    private NeuronRepository neuronRepository;

    @Autowired
    private BrainRepository brainRepository;

    @Autowired
    private ClusterRepository clusterRepository;

    @Autowired
    private BrainService brainService;

    @Autowired
    private ClusterService clusterService;

    @Autowired
    private NeuronService neuronService;

    @BeforeEach
    void setUp() {
        neuronRepository.deleteAll();
        clusterRepository.deleteAll();
        brainRepository.deleteAll();
        tagRepository.deleteAll();
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
        BrainResponse brain = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000", null));
        ClusterResponse cluster = clusterService.create(new ClusterRequest("Test Cluster", brain.id(), null));
        return neuronService.create(new NeuronRequest("Test Neuron", brain.id(), cluster.id(), null, null, null));
    }
}
