package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.BrainRequest;
import com.wliant.brainbook.dto.BrainResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.repository.BrainRepository;
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
class BrainServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private BrainService brainService;

    @Autowired
    private BrainRepository brainRepository;

    @BeforeEach
    void setUp() {
        brainRepository.deleteAll();
    }

    @Test
    void getAll_returnsEmpty() {
        List<BrainResponse> result = brainService.getAll();
        assertThat(result).isEmpty();
    }

    @Test
    void create_savesAndReturnsBrain() {
        BrainRequest request = new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000");
        BrainResponse response = brainService.create(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("Test Brain");
        assertThat(response.icon()).isEqualTo("\uD83E\uDDE0");
        assertThat(response.color()).isEqualTo("#FF0000");
        assertThat(response.isArchived()).isFalse();
        assertThat(response.createdAt()).isNotNull();
        assertThat(response.updatedAt()).isNotNull();
    }

    @Test
    void getById_returnsBrain() {
        BrainResponse created = brainService.create(new BrainRequest("Test Brain", "\uD83E\uDDE0", "#FF0000"));

        BrainResponse found = brainService.getById(created.id());

        assertThat(found.id()).isEqualTo(created.id());
        assertThat(found.name()).isEqualTo("Test Brain");
    }

    @Test
    void getById_throwsWhenNotFound() {
        UUID randomId = UUID.randomUUID();
        assertThatThrownBy(() -> brainService.getById(randomId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void update_modifiesBrain() {
        BrainResponse created = brainService.create(new BrainRequest("Original", "\uD83E\uDDE0", "#FF0000"));

        BrainResponse updated = brainService.update(created.id(), new BrainRequest("Updated", "\uD83E\uDDE0", "#FF0000"));

        assertThat(updated.name()).isEqualTo("Updated");
        assertThat(updated.id()).isEqualTo(created.id());
    }

    @Test
    void delete_removesBrain() {
        BrainResponse created = brainService.create(new BrainRequest("To Delete", "\uD83E\uDDE0", "#FF0000"));

        brainService.delete(created.id());

        assertThat(brainRepository.findById(created.id())).isEmpty();
    }

    @Test
    void archive_setsArchived() {
        BrainResponse created = brainService.create(new BrainRequest("To Archive", "\uD83E\uDDE0", "#FF0000"));

        BrainResponse archived = brainService.archive(created.id());

        assertThat(archived.isArchived()).isTrue();
    }

    @Test
    void restore_unsetsArchived() {
        BrainResponse created = brainService.create(new BrainRequest("To Restore", "\uD83E\uDDE0", "#FF0000"));
        brainService.archive(created.id());

        BrainResponse restored = brainService.restore(created.id());

        assertThat(restored.isArchived()).isFalse();
    }
}
