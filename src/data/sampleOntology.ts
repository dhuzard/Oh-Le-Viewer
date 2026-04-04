export const sampleOntology = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.com/ontology#> .

<http://example.com/ontology> a owl:Ontology ;
  owl:imports <http://example.com/shared/core> .

ex:Thing a owl:Class ;
  rdfs:label "Thing" .

ex:Person a owl:Class ;
  rdfs:subClassOf ex:Thing ;
  rdfs:label "Person" ;
  rdfs:comment "Someone who participates in the ecosystem." .

ex:Institution a owl:Class ;
  rdfs:subClassOf ex:Thing ;
  rdfs:label "Institution" .

ex:Project a owl:Class ;
  rdfs:subClassOf ex:Thing ;
  rdfs:label "Project" .

ex:Researcher a owl:Class ;
  rdfs:subClassOf ex:Person ;
  rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty ex:worksOn ;
    owl:someValuesFrom ex:Project
  ] ;
  rdfs:label "Researcher" .

ex:CollaboratingResearcher a owl:Class ;
  rdfs:subClassOf ex:Researcher ;
  owl:equivalentClass [
    owl:intersectionOf (
      ex:Researcher
      [ a owl:Restriction ; owl:onProperty ex:affiliatedWith ; owl:someValuesFrom ex:Institution ]
    )
  ] ;
  rdfs:label "Collaborating Researcher" .

ex:Contributor a owl:Class ;
  owl:equivalentClass [ owl:unionOf ( ex:Person ex:Institution ) ] ;
  rdfs:label "Contributor" .

ex:SoloProject a owl:Class ;
  owl:disjointWith ex:Institution ;
  owl:disjointWith [ owl:complementOf ex:Project ] ;
  rdfs:label "Solo Project" .

ex:fullName a owl:DatatypeProperty ;
  rdfs:label "full name" ;
  rdfs:domain ex:Person ;
  rdfs:range xsd:string .

ex:email a owl:DatatypeProperty ;
  rdfs:label "email" ;
  rdfs:domain ex:Researcher ;
  rdfs:range xsd:string .

ex:worksOn a owl:ObjectProperty ;
  rdfs:label "works on" ;
  rdfs:domain ex:Researcher ;
  rdfs:range ex:Project .

ex:affiliatedWith a owl:ObjectProperty ;
  rdfs:label "affiliated with" ;
  rdfs:domain ex:Person ;
  rdfs:range ex:Institution .
`;

export const sampleImportedOntology = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <http://example.com/ontology#> .
@prefix core: <http://example.com/shared/core#> .

<http://example.com/shared/core> a owl:Ontology .

core:SharedEntity a owl:Class ;
  rdfs:label "Shared Entity" .

ex:Person rdfs:subClassOf core:SharedEntity .
`;