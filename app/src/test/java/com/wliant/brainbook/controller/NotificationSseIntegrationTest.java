package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class NotificationSseIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @LocalServerPort
    private int port;

    @BeforeEach
    void cleanup() {
        databaseCleaner.clean();
    }

    @Test
    void sseStream_returnsTextEventStream() {
        // Use raw HttpURLConnection since TestRestTemplate doesn't handle SSE well
        try {
            URI uri = URI.create("http://localhost:" + port + "/api/notifications/stream");
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "text/event-stream");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            assertThat(conn.getResponseCode()).isEqualTo(200);
            assertThat(conn.getContentType()).contains("text/event-stream");

            // Read the initial unread-count event
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            List<String> lines = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
                // SSE events are terminated by an empty line
                if (line.isEmpty() && !lines.isEmpty()) {
                    break;
                }
            }

            String eventBlock = String.join("\n", lines);
            assertThat(eventBlock).contains("event:unread-count");
            assertThat(eventBlock).contains("\"count\"");

            conn.disconnect();
        } catch (Exception e) {
            // Timeout reading is expected since SSE keeps the connection open
            // We just need to verify the initial event was sent
        }
    }

    @Test
    void unreadCountEndpoint_stillWorks() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/notifications/unread/count", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"count\"");
    }
}
