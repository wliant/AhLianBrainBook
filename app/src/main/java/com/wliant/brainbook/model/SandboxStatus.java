package com.wliant.brainbook.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

public enum SandboxStatus {

    CLONING("cloning"),
    INDEXING("indexing"),
    ACTIVE("active"),
    ERROR("error"),
    TERMINATING("terminating");

    private final String value;

    SandboxStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static SandboxStatus fromValue(String value) {
        for (SandboxStatus s : values()) {
            if (s.value.equals(value)) return s;
        }
        throw new IllegalArgumentException("Unknown sandbox status: " + value);
    }

    @Converter(autoApply = false)
    public static class JpaConverter implements AttributeConverter<SandboxStatus, String> {
        @Override
        public String convertToDatabaseColumn(SandboxStatus status) {
            return status != null ? status.getValue() : null;
        }

        @Override
        public SandboxStatus convertToEntityAttribute(String value) {
            return value != null ? SandboxStatus.fromValue(value) : null;
        }
    }
}
