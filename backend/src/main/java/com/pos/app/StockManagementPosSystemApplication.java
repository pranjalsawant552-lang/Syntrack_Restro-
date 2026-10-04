package com.pos.app;

import org.modelmapper.ModelMapper;
import org.modelmapper.convention.MatchingStrategies;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

// DataSource/JPA auto-configuration is disabled because this app defines TWO explicit
// persistence units by hand: one for the MASTER database (tenants, super admins) and
// one routed dynamically per-tenant (see com.pos.app.master.config / com.pos.app.tenant.config).
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class})
@EnableScheduling
public class StockManagementPosSystemApplication {

	public static void main(String[] args) {
		SpringApplication.run(StockManagementPosSystemApplication.class, args);
        System.out.println("Application started");
	}

	@Bean
	public ModelMapper modelMapper(){
		ModelMapper modelMapper = new ModelMapper();
		modelMapper.getConfiguration().setMatchingStrategy(MatchingStrategies.STRICT);
		return modelMapper;
	}
}
