package com.wliant.brainbook.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.sandbox")
public class SandboxConfig {

    private String rootPath = "/data/brainbook/sandboxes";
    private int maxRepoSizeMb = 1000;
    private int maxTotalDiskMb = 5120;
    private int cloneTimeoutSec = 300;
    private int maxConcurrentClones = 2;
    private int maxCount = 10;
    private double fuzzyThreshold = 0.7;
    private int staleDays = 30;

    public String getRootPath() { return rootPath; }
    public void setRootPath(String rootPath) { this.rootPath = rootPath; }

    public int getMaxRepoSizeMb() { return maxRepoSizeMb; }
    public void setMaxRepoSizeMb(int maxRepoSizeMb) { this.maxRepoSizeMb = maxRepoSizeMb; }

    public int getMaxTotalDiskMb() { return maxTotalDiskMb; }
    public void setMaxTotalDiskMb(int maxTotalDiskMb) { this.maxTotalDiskMb = maxTotalDiskMb; }

    public int getCloneTimeoutSec() { return cloneTimeoutSec; }
    public void setCloneTimeoutSec(int cloneTimeoutSec) { this.cloneTimeoutSec = cloneTimeoutSec; }

    public int getMaxConcurrentClones() { return maxConcurrentClones; }
    public void setMaxConcurrentClones(int maxConcurrentClones) { this.maxConcurrentClones = maxConcurrentClones; }

    public int getMaxCount() { return maxCount; }
    public void setMaxCount(int maxCount) { this.maxCount = maxCount; }

    public double getFuzzyThreshold() { return fuzzyThreshold; }
    public void setFuzzyThreshold(double fuzzyThreshold) { this.fuzzyThreshold = fuzzyThreshold; }

    public int getStaleDays() { return staleDays; }
    public void setStaleDays(int staleDays) { this.staleDays = staleDays; }

    public long getMaxRepoSizeBytes() { return (long) maxRepoSizeMb * 1024 * 1024; }
    public long getMaxTotalDiskBytes() { return (long) maxTotalDiskMb * 1024 * 1024; }
}
