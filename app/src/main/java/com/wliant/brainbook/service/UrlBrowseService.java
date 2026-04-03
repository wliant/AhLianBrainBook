package com.wliant.brainbook.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.wliant.brainbook.dto.FileContentResponse;
import com.wliant.brainbook.dto.FileTreeEntryResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.ProjectConfig;
import com.wliant.brainbook.repository.ProjectConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class UrlBrowseService {

    private static final Logger logger = LoggerFactory.getLogger(UrlBrowseService.class);
    private static final Pattern GITHUB_URL_PATTERN = Pattern.compile(
            "^https?://github\\.com/([^/]+)/([^/.]+?)(?:\\.git)?/?$"
    );

    private static final Map<String, String> EXTENSION_TO_LANGUAGE = Map.ofEntries(
            Map.entry("java", "java"),
            Map.entry("py", "python"),
            Map.entry("js", "javascript"),
            Map.entry("jsx", "javascript"),
            Map.entry("ts", "typescript"),
            Map.entry("tsx", "typescript"),
            Map.entry("go", "go"),
            Map.entry("rs", "rust"),
            Map.entry("cpp", "cpp"),
            Map.entry("cc", "cpp"),
            Map.entry("cxx", "cpp"),
            Map.entry("c", "c"),
            Map.entry("h", "c"),
            Map.entry("hpp", "cpp"),
            Map.entry("cs", "csharp"),
            Map.entry("html", "html"),
            Map.entry("htm", "html"),
            Map.entry("css", "css"),
            Map.entry("scss", "css"),
            Map.entry("json", "json"),
            Map.entry("md", "markdown"),
            Map.entry("sql", "sql"),
            Map.entry("xml", "xml"),
            Map.entry("yaml", "yaml"),
            Map.entry("yml", "yaml"),
            Map.entry("sh", "bash"),
            Map.entry("bash", "bash"),
            Map.entry("kt", "kotlin"),
            Map.entry("gradle", "groovy"),
            Map.entry("toml", "toml")
    );

    private final ProjectConfigRepository projectConfigRepository;
    private final RestClient restClient;

    public UrlBrowseService(
            ProjectConfigRepository projectConfigRepository,
            @Value("${GITHUB_API_TOKEN:}") String githubToken) {
        this.projectConfigRepository = projectConfigRepository;

        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28");

        if (githubToken != null && !githubToken.isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + githubToken);
        }

        this.restClient = builder.build();
    }

    // Visible for testing
    UrlBrowseService(ProjectConfigRepository projectConfigRepository, RestClient restClient) {
        this.projectConfigRepository = projectConfigRepository;
        this.restClient = restClient;
    }

    @Cacheable(value = "githubTree", key = "'tree:' + #clusterId + ':' + #ref")
    public List<FileTreeEntryResponse> getTree(UUID clusterId, String ref) {
        ProjectConfig config = getProjectConfig(clusterId);
        String[] ownerRepo = parseGitHubRepo(config.getRepoUrl());
        String resolvedRef = resolveRef(ref, config);

        JsonNode response = restClient.get()
                .uri("/repos/{owner}/{repo}/git/trees/{ref}?recursive=1",
                        ownerRepo[0], ownerRepo[1], resolvedRef)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    throw new ResourceNotFoundException("GitHub repository or ref not found: "
                            + ownerRepo[0] + "/" + ownerRepo[1] + " @ " + resolvedRef);
                })
                .body(JsonNode.class);

        List<FileTreeEntryResponse> entries = new ArrayList<>();
        if (response != null && response.has("tree")) {
            for (JsonNode node : response.get("tree")) {
                String path = node.get("path").asText();
                String type = node.get("type").asText();
                String entryType = "tree".equals(type) ? "directory" : "file";
                Long size = node.has("size") ? node.get("size").asLong() : null;
                String name = path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path;
                entries.add(new FileTreeEntryResponse(name, path, entryType, size));
            }
        }

        return entries;
    }

    @Cacheable(value = "githubFile", key = "#clusterId + ':' + #ref + ':' + #path")
    public FileContentResponse getFile(UUID clusterId, String ref, String path) {
        ProjectConfig config = getProjectConfig(clusterId);
        String[] ownerRepo = parseGitHubRepo(config.getRepoUrl());
        String resolvedRef = resolveRef(ref, config);

        JsonNode response = restClient.get()
                .uri("/repos/{owner}/{repo}/contents/{path}?ref={ref}",
                        ownerRepo[0], ownerRepo[1], path, resolvedRef)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    throw new ResourceNotFoundException("File not found: " + path);
                })
                .body(JsonNode.class);

        if (response == null || !response.has("content")) {
            throw new ResourceNotFoundException("File content not available: " + path);
        }

        // GitHub API limits file content to 1MB; reject larger files early
        long reportedSize = response.has("size") ? response.get("size").asLong() : 0;
        if (reportedSize > 1_048_576) {
            throw new IllegalArgumentException("File too large to display: " + path
                    + " (" + (reportedSize / 1024) + " KB)");
        }

        String base64Content = response.get("content").asText().replaceAll("\\s", "");
        String content = new String(Base64.getDecoder().decode(base64Content));
        long size = response.has("size") ? response.get("size").asLong() : content.length();
        String language = detectLanguage(path);

        return new FileContentResponse(path, content, language, size);
    }

    @Cacheable(value = "githubTree", key = "'branches:' + #clusterId")
    public List<Map<String, String>> getBranches(UUID clusterId) {
        ProjectConfig config = getProjectConfig(clusterId);
        String[] ownerRepo = parseGitHubRepo(config.getRepoUrl());

        JsonNode response = restClient.get()
                .uri("/repos/{owner}/{repo}/branches", ownerRepo[0], ownerRepo[1])
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                    throw new ResourceNotFoundException("GitHub repository not found: "
                            + ownerRepo[0] + "/" + ownerRepo[1]);
                })
                .body(JsonNode.class);

        List<Map<String, String>> branches = new ArrayList<>();
        if (response != null && response.isArray()) {
            for (JsonNode node : response) {
                branches.add(Map.of("name", node.get("name").asText()));
            }
        }

        return branches;
    }

    String[] parseGitHubRepo(String repoUrl) {
        if (repoUrl == null || repoUrl.isBlank()) {
            throw new IllegalArgumentException("Repository URL is required");
        }
        Matcher matcher = GITHUB_URL_PATTERN.matcher(repoUrl.trim());
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Only GitHub repository URLs are supported. Got: " + repoUrl);
        }
        return new String[]{matcher.group(1), matcher.group(2)};
    }

    String detectLanguage(String path) {
        int dotIndex = path.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == path.length() - 1) {
            return null;
        }
        String ext = path.substring(dotIndex + 1).toLowerCase();
        return EXTENSION_TO_LANGUAGE.get(ext);
    }

    private ProjectConfig getProjectConfig(UUID clusterId) {
        return projectConfigRepository.findByClusterId(clusterId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project config not found for cluster: " + clusterId));
    }

    private String resolveRef(String ref, ProjectConfig config) {
        if (ref != null && !ref.isBlank()) {
            return ref;
        }
        return config.getDefaultBranch() != null ? config.getDefaultBranch() : "main";
    }
}
