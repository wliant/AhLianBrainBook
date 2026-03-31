package com.wliant.brainbook.controller;

import com.wliant.brainbook.config.TestContainersConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ConnectionPoolIntegrationTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private DataSource dataSource;

    @Test
    void hikariPoolConfigured_withCustomSettings() {
        assertThat(dataSource).isInstanceOf(HikariDataSource.class);

        HikariDataSource hikari = (HikariDataSource) dataSource;
        assertThat(hikari.getMaximumPoolSize()).isEqualTo(10);
        assertThat(hikari.getMinimumIdle()).isEqualTo(2);
        assertThat(hikari.getIdleTimeout()).isEqualTo(300_000);
        assertThat(hikari.getMaxLifetime()).isEqualTo(1_800_000);
        assertThat(hikari.getConnectionTimeout()).isEqualTo(10_000);
        assertThat(hikari.getLeakDetectionThreshold()).isEqualTo(30_000);
    }
}
