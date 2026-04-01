package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum ClusterStatus {

    GENERATING("generating"),
    READY("ready");

    private final String value;

    ClusterStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ClusterStatus fromValue(String value) {
        for (ClusterStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown cluster status: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<ClusterStatus, String> {
        @Override
        public String convertToDatabaseColumn(ClusterStatus status) {
            return status != null ? status.getValue() : null;
        }

        @Override
        public ClusterStatus convertToEntityAttribute(String value) {
            return value != null ? ClusterStatus.fromValue(value) : null;
        }
    }
}
