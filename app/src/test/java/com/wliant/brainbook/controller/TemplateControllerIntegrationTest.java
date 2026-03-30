package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.dto.TemplateRequest;
import com.wliant.brainbook.dto.TemplateResponse;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class TemplateControllerIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();
    }

    @Test
    void createTemplate_succeeds() {
        TemplateRequest request = new TemplateRequest("Daily Note", "A daily journal template",
                "{\"type\":\"doc\"}");

        ResponseEntity<TemplateResponse> response = restTemplate.postForEntity(
                "/api/templates", request, TemplateResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Daily Note");
        assertThat(response.getBody().description()).isEqualTo("A daily journal template");
        assertThat(response.getBody().contentJson()).isEqualTo("{\"type\":\"doc\"}");
        assertThat(response.getBody().id()).isNotNull();
    }

    @Test
    void getAllTemplates_returnsList() {
        restTemplate.postForEntity("/api/templates",
                new TemplateRequest("Template 1", "desc1", "{}"), TemplateResponse.class);
        restTemplate.postForEntity("/api/templates",
                new TemplateRequest("Template 2", "desc2", "{}"), TemplateResponse.class);

        ResponseEntity<List<TemplateResponse>> response = restTemplate.exchange(
                "/api/templates",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<List<TemplateResponse>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void getTemplateById_returnsTemplate() {
        ResponseEntity<TemplateResponse> createResponse = restTemplate.postForEntity(
                "/api/templates",
                new TemplateRequest("Meeting Notes", "For meetings", "{\"meeting\":true}"),
                TemplateResponse.class);
        UUID templateId = createResponse.getBody().id();

        ResponseEntity<TemplateResponse> response = restTemplate.getForEntity(
                "/api/templates/{id}", TemplateResponse.class, templateId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Meeting Notes");
        assertThat(response.getBody().id()).isEqualTo(templateId);
    }

    @Test
    void updateTemplate_modifiesTemplate() {
        ResponseEntity<TemplateResponse> createResponse = restTemplate.postForEntity(
                "/api/templates",
                new TemplateRequest("Original", "original desc", "{}"),
                TemplateResponse.class);
        UUID templateId = createResponse.getBody().id();

        TemplateRequest updateRequest = new TemplateRequest("Updated", "updated desc",
                "{\"updated\":true}");
        ResponseEntity<TemplateResponse> response = restTemplate.exchange(
                "/api/templates/{id}",
                HttpMethod.PATCH,
                new HttpEntity<>(updateRequest),
                TemplateResponse.class,
                templateId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().name()).isEqualTo("Updated");
        assertThat(response.getBody().description()).isEqualTo("updated desc");
    }

    @Test
    void deleteTemplate_removes() {
        ResponseEntity<TemplateResponse> createResponse = restTemplate.postForEntity(
                "/api/templates",
                new TemplateRequest("To Delete", "desc", "{}"),
                TemplateResponse.class);
        UUID templateId = createResponse.getBody().id();

        ResponseEntity<Void> deleteResponse = restTemplate.exchange(
                "/api/templates/{id}",
                HttpMethod.DELETE,
                null,
                Void.class,
                templateId);

        assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> getResponse = restTemplate.getForEntity(
                "/api/templates/{id}", String.class, templateId);
        assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
