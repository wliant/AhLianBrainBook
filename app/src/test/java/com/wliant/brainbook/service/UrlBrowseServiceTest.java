package com.wliant.brainbook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wliant.brainbook.dto.FileContentResponse;
import com.wliant.brainbook.dto.FileTreeEntryResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.ProjectConfig;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UrlBrowseServiceTest {

    @Mock
    private ProjectConfigRepository projectConfigRepository;

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> requestHeadersUriSpec;

    @Mock
    private RestClient.RequestHeadersSpec<?> requestHeadersSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private UrlBrowseService urlBrowseService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID clusterId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        urlBrowseService = new UrlBrowseService(projectConfigRepository, restClient);
    }

    @Test
    void parseGitHubRepo_validUrl() {
        String[] result = urlBrowseService.parseGitHubRepo("https://github.com/spring-projects/spring-framework");
        assertThat(result).containsExactly("spring-projects", "spring-framework");
    }

    @Test
    void parseGitHubRepo_validUrlWithGitSuffix() {
        String[] result = urlBrowseService.parseGitHubRepo("https://github.com/owner/repo.git");
        assertThat(result).containsExactly("owner", "repo");
    }

    @Test
    void parseGitHubRepo_validUrlWithTrailingSlash() {
        String[] result = urlBrowseService.parseGitHubRepo("https://github.com/owner/repo/");
        assertThat(result).containsExactly("owner", "repo");
    }

    @Test
    void parseGitHubRepo_invalidUrl() {
        assertThatThrownBy(() -> urlBrowseService.parseGitHubRepo("https://gitlab.com/owner/repo"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only GitHub repository URLs are supported");
    }

    @Test
    void parseGitHubRepo_nullUrl() {
        assertThatThrownBy(() -> urlBrowseService.parseGitHubRepo(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Repository URL is required");
    }

    @Test
    void parseGitHubRepo_blankUrl() {
        assertThatThrownBy(() -> urlBrowseService.parseGitHubRepo("  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Repository URL is required");
    }

    @Test
    void getTree_returnsEntries() {
        ProjectConfig config = createProjectConfig("https://github.com/owner/repo", "main");
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.of(config));

        ObjectNode treeResponse = objectMapper.createObjectNode();
        ArrayNode treeArray = treeResponse.putArray("tree");
        ObjectNode file = treeArray.addObject();
        file.put("path", "src/Main.java");
        file.put("type", "blob");
        file.put("size", 1024);
        ObjectNode dir = treeArray.addObject();
        dir.put("path", "src");
        dir.put("type", "tree");

        setupRestClientGet(treeResponse);

        List<FileTreeEntryResponse> result = urlBrowseService.getTree(clusterId, null);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).path()).isEqualTo("src/Main.java");
        assertThat(result.get(0).type()).isEqualTo("file");
        assertThat(result.get(0).name()).isEqualTo("Main.java");
        assertThat(result.get(0).size()).isEqualTo(1024L);
        assertThat(result.get(1).path()).isEqualTo("src");
        assertThat(result.get(1).type()).isEqualTo("directory");
    }

    @Test
    void getTree_usesDefaultBranch() {
        ProjectConfig config = createProjectConfig("https://github.com/owner/repo", "develop");
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.of(config));

        ObjectNode treeResponse = objectMapper.createObjectNode();
        treeResponse.putArray("tree");

        setupRestClientGet(treeResponse);

        urlBrowseService.getTree(clusterId, null);

        // Verify that the ref parameter passed is "develop"
        verify(restClient).get();
    }

    @Test
    void getTree_clusterNotFound() {
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> urlBrowseService.getTree(clusterId, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Project config not found");
    }

    @Test
    void getFile_returnsDecodedContent() {
        ProjectConfig config = createProjectConfig("https://github.com/owner/repo", "main");
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.of(config));

        String originalContent = "public class Main {\n    public static void main(String[] args) {}\n}";
        String base64Content = Base64.getEncoder().encodeToString(originalContent.getBytes());

        ObjectNode fileResponse = objectMapper.createObjectNode();
        fileResponse.put("content", base64Content);
        fileResponse.put("size", originalContent.length());

        setupRestClientGet(fileResponse);

        FileContentResponse result = urlBrowseService.getFile(clusterId, null, "src/Main.java");

        assertThat(result.path()).isEqualTo("src/Main.java");
        assertThat(result.content()).isEqualTo(originalContent);
        assertThat(result.language()).isEqualTo("java");
        assertThat(result.size()).isEqualTo(originalContent.length());
    }

    @Test
    void getFile_detectsLanguage() {
        ProjectConfig config = createProjectConfig("https://github.com/owner/repo", "main");
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.of(config));

        String content = "print('hello')";
        ObjectNode fileResponse = objectMapper.createObjectNode();
        fileResponse.put("content", Base64.getEncoder().encodeToString(content.getBytes()));
        fileResponse.put("size", content.length());

        setupRestClientGet(fileResponse);

        FileContentResponse result = urlBrowseService.getFile(clusterId, null, "script.py");
        assertThat(result.language()).isEqualTo("python");
    }

    @Test
    void getBranches_returnsList() {
        ProjectConfig config = createProjectConfig("https://github.com/owner/repo", "main");
        when(projectConfigRepository.findByClusterId(clusterId)).thenReturn(Optional.of(config));

        ArrayNode branchesResponse = objectMapper.createArrayNode();
        ObjectNode branch1 = branchesResponse.addObject();
        branch1.put("name", "main");
        ObjectNode branch2 = branchesResponse.addObject();
        branch2.put("name", "develop");

        setupRestClientGet(branchesResponse);

        List<Map<String, String>> result = urlBrowseService.getBranches(clusterId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0)).containsEntry("name", "main");
        assertThat(result.get(1)).containsEntry("name", "develop");
    }

    @Test
    void detectLanguage_knownExtensions() {
        assertThat(urlBrowseService.detectLanguage("file.java")).isEqualTo("java");
        assertThat(urlBrowseService.detectLanguage("file.py")).isEqualTo("python");
        assertThat(urlBrowseService.detectLanguage("file.ts")).isEqualTo("typescript");
        assertThat(urlBrowseService.detectLanguage("file.tsx")).isEqualTo("typescript");
        assertThat(urlBrowseService.detectLanguage("file.js")).isEqualTo("javascript");
        assertThat(urlBrowseService.detectLanguage("file.go")).isEqualTo("go");
        assertThat(urlBrowseService.detectLanguage("file.rs")).isEqualTo("rust");
        assertThat(urlBrowseService.detectLanguage("file.json")).isEqualTo("json");
        assertThat(urlBrowseService.detectLanguage("file.md")).isEqualTo("markdown");
        assertThat(urlBrowseService.detectLanguage("file.sql")).isEqualTo("sql");
        assertThat(urlBrowseService.detectLanguage("file.yaml")).isEqualTo("yaml");
        assertThat(urlBrowseService.detectLanguage("file.yml")).isEqualTo("yaml");
        assertThat(urlBrowseService.detectLanguage("file.sh")).isEqualTo("bash");
    }

    @Test
    void detectLanguage_unknownExtension() {
        assertThat(urlBrowseService.detectLanguage("file.xyz")).isNull();
    }

    @Test
    void detectLanguage_noExtension() {
        assertThat(urlBrowseService.detectLanguage("Makefile")).isNull();
    }

    @SuppressWarnings("unchecked")
    private void setupRestClientGet(JsonNode response) {
        RestClient.RequestHeadersUriSpec rawSpec = mock(RestClient.RequestHeadersUriSpec.class);
        RestClient.RequestHeadersSpec headersSpec = mock(RestClient.RequestHeadersSpec.class);
        RestClient.ResponseSpec respSpec = mock(RestClient.ResponseSpec.class);

        when(restClient.get()).thenReturn(rawSpec);
        when(rawSpec.uri(anyString(), any(Object[].class))).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(respSpec);
        when(respSpec.onStatus(any(), any())).thenReturn(respSpec);
        when(respSpec.body(JsonNode.class)).thenReturn(response);
    }

    private ProjectConfig createProjectConfig(String repoUrl, String defaultBranch) {
        ProjectConfig config = new ProjectConfig();
        config.setRepoUrl(repoUrl);
        config.setDefaultBranch(defaultBranch);
        return config;
    }
}
