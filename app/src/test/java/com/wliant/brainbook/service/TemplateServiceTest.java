package com.wliant.brainbook.service;

import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.TemplateRequest;
import com.wliant.brainbook.dto.TemplateResponse;
import com.wliant.brainbook.repository.TemplateRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TemplateServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private TemplateRepository templateRepository;

    @BeforeEach
    void setUp() {
        templateRepository.deleteAll();
    }

    @Test
    void create_savesTemplate() {
        TemplateResponse response = templateService.create(new TemplateRequest("Daily Note", "desc", "{}"));

        assertThat(response.id()).isNotNull();
        assertThat(response.name()).isEqualTo("Daily Note");
        assertThat(response.description()).isEqualTo("desc");
        assertThat(response.contentJson()).isEqualTo("{}");
    }

    @Test
    void getAll_returnsTemplates() {
        templateService.create(new TemplateRequest("Template 1", "desc1", "{}"));
        templateService.create(new TemplateRequest("Template 2", "desc2", "{}"));

        List<TemplateResponse> templates = templateService.getAll();

        assertThat(templates).hasSize(2);
    }

    @Test
    void getById_returnsTemplate() {
        TemplateResponse created = templateService.create(new TemplateRequest("Daily Note", "desc", "{}"));

        TemplateResponse found = templateService.getById(created.id());

        assertThat(found.id()).isEqualTo(created.id());
        assertThat(found.name()).isEqualTo("Daily Note");
    }

    @Test
    void update_modifiesTemplate() {
        TemplateResponse created = templateService.create(new TemplateRequest("Original", "desc", "{}"));

        TemplateResponse updated = templateService.update(created.id(),
                new TemplateRequest("Updated", "new desc", "{\"updated\":true}"));

        assertThat(updated.name()).isEqualTo("Updated");
        assertThat(updated.description()).isEqualTo("new desc");
        assertThat(updated.id()).isEqualTo(created.id());
    }

    @Test
    void delete_removesTemplate() {
        TemplateResponse created = templateService.create(new TemplateRequest("To Delete", "desc", "{}"));

        templateService.delete(created.id());

        assertThat(templateRepository.findById(created.id())).isEmpty();
    }
}
